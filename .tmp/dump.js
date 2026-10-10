global.MB_COURSE={addChapter(c){global.C=c}};global.MB_FIG=new Proxy({},{get:()=>()=>''});
const f=process.argv[2];require('D:/Work/Web/studyuBitProj/lessons/'+f+'.js');
for(const s of C.sections){console.log('=== '+s.id+' '+s.title);
 s.content.filter(b=>b.type==='code').forEach(b=>console.log('  [code] '+b.title+(b.run===false?' (run:false)':'')+(b.repl?' (repl)':'')));
 for(const p of s.practice||[]){console.log('--- PRACTICE '+p.title+'\n'+p.solution);}}
