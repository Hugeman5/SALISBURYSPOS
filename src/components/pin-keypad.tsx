'use client';
import { useState } from 'react';

export function PinKeypad({ onSubmit, busy }: { onSubmit: (pin: string)=>void; busy?: boolean }) {
  const [pin, setPin] = useState('');
  const push = (n: string) => {
    if (busy) return;
    const nxt = (pin + n).slice(0,4);
    setPin(nxt);
    if (nxt.length === 4) onSubmit(nxt);
  };
  const clear = () => setPin('');
  const back = () => setPin(pin.slice(0,-1));

  return (
    <div style={{ maxWidth: 280 }}>
      <div style={{ fontSize: 28, letterSpacing: 8, textAlign:'center', marginBottom: 12 }}>
        {pin.padEnd(4, '•')}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {'123456789'.split('').map(d => (
          <button key={d} onClick={()=>push(d)} disabled={busy} style={btn}>{d}</button>
        ))}
        <button onClick={back} disabled={busy} style={btn}>⌫</button>
        <button onClick={()=>push('0')} disabled={busy} style={btn}>0</button>
        <button onClick={clear} disabled={busy} style={btn}>C</button>
      </div>
    </div>
  );
}
const btn: React.CSSProperties = { padding:'14px 0', fontSize:18, border:'1px solid #ddd', borderRadius:8, background:'#fff' };
