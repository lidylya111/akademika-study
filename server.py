#!/usr/bin/env python3
import json, os, sqlite3, secrets, subprocess, tempfile, uuid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from datetime import datetime, timezone
from email.parser import BytesParser
from email.policy import default as email_policy

ROOT = Path(__file__).resolve().parent

# On Railway always use the path of the actually attached persistent Volume.
# This prevents accidental writes to the ephemeral /app filesystem after a redeploy.
ON_RAILWAY = bool(os.environ.get('RAILWAY_PROJECT_ID'))
RAILWAY_VOLUME_MOUNT_PATH = (os.environ.get('RAILWAY_VOLUME_MOUNT_PATH') or '').strip()
if ON_RAILWAY:
    if not RAILWAY_VOLUME_MOUNT_PATH:
        raise RuntimeError(
            'Railway Volume is not attached. Attach a Volume before starting Akademika Study.'
        )
    DATA_DIR = Path(RAILWAY_VOLUME_MOUNT_PATH).resolve()
else:
    DATA_DIR = Path(os.environ.get('DATA_DIR', str(ROOT))).resolve()

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR = DATA_DIR / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DB = DATA_DIR / 'akademika.sqlite3'
PORT = int(os.environ.get('PORT', '8000'))
TEACHER_PIN = os.environ.get('TEACHER_PIN', '2468')
MAX_UPLOAD = 40 * 1024 * 1024

DEFAULT_CONTENT = None

def load_default_content():
    global DEFAULT_CONTENT
    DEFAULT_CONTENT=json.loads((ROOT/'content.json').read_text(encoding='utf-8'))
    return DEFAULT_CONTENT

def db():
    con=sqlite3.connect(DB, timeout=30)
    con.row_factory=sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    return con

def init_db():
    c=db(); cur=c.cursor()
    cur.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    cur.execute('CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)')
    cur.execute('''CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        topic_id TEXT NOT NULL,
        percent INTEGER NOT NULL,
        stars INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE(student_id, topic_id),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE)''')
    if not cur.execute("SELECT 1 FROM settings WHERE key='content'").fetchone():
        cur.execute("INSERT INTO settings(key,value) VALUES('content',?)", (json.dumps(load_default_content(), ensure_ascii=False),))
    c.commit(); c.close()

def get_content():
    c=db(); row=c.execute("SELECT value FROM settings WHERE key='content'").fetchone(); c.close()
    return json.loads(row['value'])

def set_content(obj):
    c=db(); c.execute("INSERT INTO settings(key,value) VALUES('content',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(obj,ensure_ascii=False),)); c.commit(); c.close()

def now(): return datetime.now(timezone.utc).isoformat()

def code6():
    alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(secrets.choice(alphabet) for _ in range(6))

def parse_multipart(handler):
    ctype=handler.headers.get('Content-Type','')
    if 'multipart/form-data' not in ctype:
        raise ValueError('Ожидалась форма с файлом')
    n=int(handler.headers.get('Content-Length','0') or 0)
    if n<=0 or n>MAX_UPLOAD:
        raise ValueError('Файл слишком большой. Максимум 40 МБ')
    body=handler.rfile.read(n)
    raw=(f'Content-Type: {ctype}\r\nMIME-Version: 1.0\r\n\r\n').encode()+body
    msg=BytesParser(policy=email_policy).parsebytes(raw)
    fields={}; files={}
    for part in msg.iter_parts():
        name=part.get_param('name', header='content-disposition')
        filename=part.get_filename()
        payload=part.get_payload(decode=True) or b''
        if not name: continue
        if filename:
            files[name]={'filename':filename,'data':payload,'content_type':part.get_content_type()}
        else:
            fields[name]=payload.decode(part.get_content_charset() or 'utf-8', errors='replace')
    return fields,files

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p=urlparse(path).path
        if p=='/': p='/index.html'
        if p.startswith('/uploads/'):
            name=Path(p).name
            return str(UPLOAD_DIR / name)
        return str(ROOT / p.lstrip('/'))

    def log_message(self, format, *args):
        print('[Akademika]', format%args)

    def json_body(self):
        n=int(self.headers.get('Content-Length','0') or 0)
        return json.loads(self.rfile.read(n) or b'{}')

    def send_json(self,obj,status=200):
        data=json.dumps(obj,ensure_ascii=False).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(data)

    def teacher_ok(self): return self.headers.get('X-Teacher-Pin','')==TEACHER_PIN

    def do_GET(self):
        u=urlparse(self.path)
        if u.path in ('/akademika.sqlite3','/server.py') or u.path.startswith('/.git'):
            return self.send_json({'error':'Не найдено'},404)
        if u.path=='/api/state':
            qs=parse_qs(u.query); code=(qs.get('student') or [''])[0]
            c=db(); student=None; prog={}
            if code:
                r=c.execute('SELECT * FROM students WHERE code=?',(code,)).fetchone()
                if r:
                    student={'id':r['id'],'name':r['name'],'code':r['code']}
                    for p in c.execute('SELECT * FROM progress WHERE student_id=?',(r['id'],)).fetchall():
                        prog[p['topic_id']]={'percent':p['percent'],'stars':p['stars'],'attempts':p['attempts'],'date':p['updated_at']}
            if not student:
                student={'name':'Гость','code':'guest'}
            c.close(); return self.send_json({'content':get_content(),'student':student,'progress':prog})
        if u.path=='/api/admin':
            if not self.teacher_ok(): return self.send_json({'error':'Неверный PIN'},401)
            c=db(); students=[dict(r) for r in c.execute('SELECT id,name,code,created_at FROM students ORDER BY name').fetchall()]
            rows=c.execute('''SELECT p.topic_id,p.percent,p.stars,p.attempts,p.updated_at as date,s.name as student_name
                              FROM progress p JOIN students s ON s.id=p.student_id ORDER BY p.updated_at DESC''').fetchall()
            c.close(); return self.send_json({'content':get_content(),'students':students,'results':[dict(r) for r in rows]})
        return super().do_GET()

    def do_PUT(self):
        if self.path=='/api/content':
            if not self.teacher_ok(): return self.send_json({'error':'Неверный PIN'},401)
            try: obj=self.json_body(); set_content(obj); return self.send_json({'ok':True})
            except Exception: return self.send_json({'error':'Не удалось сохранить курс'},400)
        return self.send_json({'error':'Не найдено'},404)

    def do_POST(self):
        u=urlparse(self.path)
        if u.path=='/api/progress':
            try: data=self.json_body(); code=data.get('studentCode','')
            except: return self.send_json({'error':'Некорректные данные'},400)
            if not code or code=='guest': return self.send_json({'ok':True,'saved':False})
            c=db(); s=c.execute('SELECT id FROM students WHERE code=?',(code,)).fetchone()
            if not s: c.close(); return self.send_json({'error':'Ученик не найден'},404)
            c.execute('''INSERT INTO progress(student_id,topic_id,percent,stars,attempts,updated_at) VALUES(?,?,?,?,?,?)
                         ON CONFLICT(student_id,topic_id) DO UPDATE SET percent=excluded.percent,stars=excluded.stars,attempts=excluded.attempts,updated_at=excluded.updated_at''',
                      (s['id'],data.get('topicId',''),int(data.get('percent',0)),int(data.get('stars',0)),int(data.get('attempts',0)),now()))
            c.commit(); c.close(); return self.send_json({'ok':True,'saved':True})
        if u.path=='/api/students':
            if not self.teacher_ok(): return self.send_json({'error':'Неверный PIN'},401)
            data=self.json_body(); name=str(data.get('name','')).strip()
            if not name: return self.send_json({'error':'Введите имя'},400)
            c=db(); code=code6()
            while c.execute('SELECT 1 FROM students WHERE code=?',(code,)).fetchone(): code=code6()
            cur=c.execute('INSERT INTO students(name,code,created_at) VALUES(?,?,?)',(name,code,now())); c.commit(); sid=cur.lastrowid; c.close()
            return self.send_json({'student':{'id':sid,'name':name,'code':code}})
        if u.path=='/api/presentations':
            if not self.teacher_ok(): return self.send_json({'error':'Неверный PIN'},401)
            try:
                fields,files=parse_multipart(self)
                topic_id=(fields.get('topicId') or '').strip()
                title=(fields.get('title') or 'Презентация').strip() or 'Презентация'
                f=files.get('file')
                if not f: raise ValueError('Выберите файл')
                original=Path(f['filename']).name
                ext=Path(original).suffix.lower()
                if ext not in ('.pdf','.pptx'):
                    raise ValueError('Можно загрузить PDF или PPTX')
                token=uuid.uuid4().hex
                if ext=='.pdf':
                    out=UPLOAD_DIR/f'{token}.pdf'; out.write_bytes(f['data'])
                else:
                    tmpdir=Path(tempfile.mkdtemp(prefix='akademika-'))
                    src=tmpdir/f'{token}.pptx'; src.write_bytes(f['data'])
                    try:
                        proc=subprocess.run(['libreoffice','--headless','--convert-to','pdf','--outdir',str(UPLOAD_DIR),str(src)],capture_output=True,text=True,timeout=120)
                    except FileNotFoundError:
                        raise ValueError('На сервере не установлен конвертер PPTX. Загрузите PDF.')
                    finally:
                        try: src.unlink(missing_ok=True); tmpdir.rmdir()
                        except Exception: pass
                    out=UPLOAD_DIR/f'{token}.pdf'
                    if proc.returncode!=0 or not out.exists():
                        raise ValueError('Не удалось преобразовать PPTX. Сохраните презентацию как PDF и загрузите PDF.')
                obj=get_content(); topic=next((t for t in obj.get('topics',[]) if t.get('id')==topic_id),None)
                if not topic:
                    out.unlink(missing_ok=True); raise ValueError('Тема не найдена')
                mat={'id':'mat-'+uuid.uuid4().hex[:10],'type':'presentation','title':title,'source':'file','url':'/uploads/'+out.name,'sourceName':original,'createdAt':now()}
                topic.setdefault('materials',[]).append(mat); set_content(obj)
                return self.send_json({'ok':True,'material':mat,'content':obj})
            except ValueError as e: return self.send_json({'error':str(e)},400)
            except Exception as e:
                print('presentation upload error',repr(e)); return self.send_json({'error':'Не удалось загрузить презентацию'},500)
        return self.send_json({'error':'Не найдено'},404)

    def do_DELETE(self):
        if self.path.startswith('/api/students/'):
            if not self.teacher_ok(): return self.send_json({'error':'Неверный PIN'},401)
            try: sid=int(self.path.rsplit('/',1)[-1])
            except: return self.send_json({'error':'Некорректный ID'},400)
            c=db(); c.execute('DELETE FROM progress WHERE student_id=?',(sid,)); c.execute('DELETE FROM students WHERE id=?',(sid,)); c.commit(); c.close(); return self.send_json({'ok':True})
        if self.path.startswith('/api/presentations/'):
            if not self.teacher_ok(): return self.send_json({'error':'Неверный PIN'},401)
            mid=self.path.rsplit('/',1)[-1]
            obj=get_content(); found=None
            for t in obj.get('topics',[]):
                mats=t.get('materials',[])
                for m in mats:
                    if m.get('id')==mid:
                        found=m; t['materials']=[x for x in mats if x.get('id')!=mid]; break
                if found: break
            if not found: return self.send_json({'error':'Материал не найден'},404)
            url=found.get('url','')
            if found.get('source')=='file' and url.startswith('/uploads/'):
                (UPLOAD_DIR/Path(url).name).unlink(missing_ok=True)
            set_content(obj); return self.send_json({'ok':True,'content':obj})
        return self.send_json({'error':'Не найдено'},404)

if __name__=='__main__':
    os.chdir(ROOT); init_db()
    print(f'Akademika Study: http://127.0.0.1:{PORT}')
    print(f'Persistent data directory: {DATA_DIR}')
    print(f'Database file: {DB}')
    print('Teacher PIN:', TEACHER_PIN if TEACHER_PIN=='2468' else '(set in environment)')
    ThreadingHTTPServer(('0.0.0.0',PORT),Handler).serve_forever()
