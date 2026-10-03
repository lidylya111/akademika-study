#!/usr/bin/env python3
import json, os, sqlite3, secrets, string, mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('DATA_DIR', str(ROOT))).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB = DATA_DIR / 'akademika.sqlite3'
PORT = int(os.environ.get('PORT', '8000'))
TEACHER_PIN = os.environ.get('TEACHER_PIN', '2468')

DEFAULT_CONTENT = None

def load_default_content():
    global DEFAULT_CONTENT
    DEFAULT_CONTENT=json.loads((ROOT/'content.json').read_text(encoding='utf-8'))
    return DEFAULT_CONTENT

def db():
    con=sqlite3.connect(DB)
    con.row_factory=sqlite3.Row
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

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p=urlparse(path).path
        if p=='/': p='/index.html'
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
            except Exception as e: return self.send_json({'error':'Не удалось сохранить курс'},400)
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
        return self.send_json({'error':'Не найдено'},404)

    def do_DELETE(self):
        if self.path.startswith('/api/students/'):
            if not self.teacher_ok(): return self.send_json({'error':'Неверный PIN'},401)
            try: sid=int(self.path.rsplit('/',1)[-1])
            except: return self.send_json({'error':'Некорректный ID'},400)
            c=db(); c.execute('DELETE FROM progress WHERE student_id=?',(sid,)); c.execute('DELETE FROM students WHERE id=?',(sid,)); c.commit(); c.close(); return self.send_json({'ok':True})
        return self.send_json({'error':'Не найдено'},404)

if __name__=='__main__':
    os.chdir(ROOT); init_db()
    print(f'Akademika Study: http://127.0.0.1:{PORT}')
    print('Teacher PIN:', TEACHER_PIN if TEACHER_PIN=='2468' else '(set in environment)')
    ThreadingHTTPServer(('0.0.0.0',PORT),Handler).serve_forever()
