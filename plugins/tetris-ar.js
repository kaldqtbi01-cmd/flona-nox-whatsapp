const W = 8, H = 12;
const SHAPES = [
  [[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]],
  [[1,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]], [[0,0],[0,1],[1,1],[2,1]], [[2,0],[0,1],[1,1],[2,1]]
];
const keyByChat = chat => `${chat}`;
function newPiece() { return { shape: SHAPES[Math.floor(Math.random() * SHAPES.length)].map(([x,y])=>[x,y]), x: 2, y: 0 }; }
function collides(g, p) {
  return p.shape.some(([x,y]) => { const xx=p.x+x, yy=p.y+y; return xx<0||xx>=W||yy>=H||(yy>=0&&g.board[yy][xx]); });
}
function render(g) {
  const board=g.board.map(row=>row.slice());
  for (const [x,y] of g.piece.shape) { const xx=g.piece.x+x, yy=g.piece.y+y; if(yy>=0&&yy<H&&xx>=0&&xx<W) board[yy][xx]=1; }
  const rows=board.map(row=>'│'+row.map(v=>v?'🟪':'⬛').join('')+'│').join('\n');
  return `🎮 *تتريس فلونا*\nالنقاط: ${g.score} | الأسطر: ${g.lines}\n╭──────────╮\n${rows}\n╰──────────╯\nالأوامر: يمين • يسار • دوران • اسقط\nاكتب «إنهاء تتريس» للخروج.`;
}
function spawn(g) { g.piece=newPiece(); if(collides(g,g.piece)) { g.over=true; } }
function rotate(g) { const rotated=g.piece.shape.map(([x,y])=>[-y,x]); const minX=Math.min(...rotated.map(c=>c[0])), minY=Math.min(...rotated.map(c=>c[1])); const candidate={...g.piece,shape:rotated.map(([x,y])=>[x-minX,y-minY])}; if(!collides(g,candidate)) g.piece=candidate; }
function lock(g) {
  for(const [x,y] of g.piece.shape){const xx=g.piece.x+x, yy=g.piece.y+y;if(yy>=0&&yy<H)g.board[yy][xx]=1;}
  const kept=g.board.filter(row=>row.some(cell=>!cell)); const cleared=H-kept.length;
  g.board=Array.from({length:cleared},()=>Array(W).fill(0)).concat(kept); g.lines+=cleared; g.score+=cleared*100;
  spawn(g);
}
const handler = async (m, { conn }) => {
  const id=keyByChat(m.chat); global.__flonaTetris ||= {};
  if(global.__flonaTetris[id]&&!global.__flonaTetris[id].over) return m.reply('هناك جولة تتريس نشطة هنا. استخدم «إنهاء تتريس» أو أكمل اللعب.');
  const game={board:Array.from({length:H},()=>Array(W).fill(0)),piece:newPiece(),score:0,lines:0,over:false,player:m.sender};
  global.__flonaTetris[id]=game;
  return conn.sendMessage(m.chat,{text:render(game)},{quoted:m});
};
handler.all = async function(m) {
  const id=keyByChat(m.chat), games=global.__flonaTetris||{}, g=games[id];
  if(!g||!m?.text||m.sender!==g.player) return;
  const text=m.text.trim().toLowerCase();
  if(/^(إنهاء تتريس|انهاء تتريس|توقف تتريس)$/.test(text)){delete games[id];await this.sendMessage(m.chat,{text:'انتهت جولة تتريس.'},{quoted:m});return;}
  if(!/^(يمين|يسار|دوران|لف|اسقط|إسقاط)$/.test(text)) return;
  const msgKey=`${m.chat}:${m.key?.id||''}`;global.__flonaTetrisSeen||=new Set();if(global.__flonaTetrisSeen.has(msgKey))return;global.__flonaTetrisSeen.add(msgKey);setTimeout(()=>global.__flonaTetrisSeen?.delete(msgKey),60_000).unref?.();
  if(text==='يمين'||text==='يسار'){const p={...g.piece,x:g.piece.x+(text==='يمين'?1:-1)};if(!collides(g,p))g.piece=p;}
  else if(text==='دوران'||text==='لف')rotate(g);
  else {while(!collides(g,{...g.piece,y:g.piece.y+1}))g.piece.y++;lock(g);}
  if(g.over){await this.sendMessage(m.chat,{text:`انتهت اللعبة! نتيجتك: ${g.score} نقطة، وأكملت ${g.lines} سطرًا. اكتب .تتريس لجولة جديدة.`},{quoted:m});return;}
  if(text!=='اسقط'&&text!=='إسقاط'&&!collides(g,{...g.piece,y:g.piece.y+1}))g.piece.y++;
  await this.sendMessage(m.chat,{text:render(g)},{quoted:m});
};
handler.help=['تتريس'];handler.tags=['games'];handler.command=/^(تتريس|tetris)$/i;
export default handler;
