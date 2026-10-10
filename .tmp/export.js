global.MB_COURSE={addChapter(c){global.C=c}};
global.MB_FIG={board:()=>'',screen:()=>'',tile:()=>'',ANCHOR:new Proxy({},{get:(t,k)=>k==="pad"?()=>[0,0]:[0,0]}),pad:()=>[0,0]};

const out=[];
for(const f of ['ch01','ch02','ch03','ch04','ch05','ch06','ch07','ch08']){
 try{require('D:/Work/Web/studyuBitProj/lessons/'+f+'.js');}catch(e){console.error(f,e.message);continue;}
 for(const s of C.sections){ s.content.filter(b=>b.type==='code'&&b.run!==false&&!b.repl).forEach(b=>out.push({sec:s.id,title:b.title,code:b.code}));
   (s.slides||[]).forEach(sl=>{ if(sl.code&&!sl.repl) out.push({sec:s.id,title:'[slide] '+sl.title,code:sl.code,slide:1}); });}
}
require('fs').writeFileSync('D:/Work/Web/studyuBitProj/.tmp/codes.json',JSON.stringify(out,null,1));
console.log(out.length, out.filter(o=>!o.slide).length);
