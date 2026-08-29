'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.08;

const SIZE = 100;
const TOTAL = SIZE * SIZE;
const PRICE = Number(process.env.NEXT_PUBLIC_PRICE_PER_CELL || 500);

function colToLabel(col) {
  let s = '';
  col += 1;
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
function indexToCoord(i) {
  const row = Math.floor(i / SIZE);
  const col = i % SIZE;
  return colToLabel(col) + (row + 1);
}

export default function Home() {
  const [board, setBoard] = useState(() => new Array(TOTAL).fill(null));
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [color, setColor] = useState('#3ECF8E');
  const [owner, setOwner] = useState('');
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState('');
  const [statusBanner, setStatusBanner] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: '50%', y: '50%' });
  const zoomRef = useRef(1);
  const boardRef = useRef(null);
  const boardFrameRef = useRef(null);
  const pinchRef = useRef({ distance: null, startZoom: 1 });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const el = boardFrameRef.current;
    if (!el) return;

    function setOriginFromPoint(clientX, clientY) {
      const rect = boardRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setOrigin({
        x: `${Math.min(100, Math.max(0, x))}%`,
        y: `${Math.min(100, Math.max(0, y))}%`,
      });
    }

    function handleWheel(e) {
      e.preventDefault();
      setOriginFromPoint(e.clientX, e.clientY);
      setZoom((z) => {
        const next = e.deltaY < 0 ? z + ZOOM_STEP : z - ZOOM_STEP;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      });
    }

    function getDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }
    function getMidpoint(touches) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    }

    function handleTouchStart(e) {
      if (e.touches.length === 2) {
        pinchRef.current.distance = getDistance(e.touches);
        pinchRef.current.startZoom = zoomRef.current;
        const mid = getMidpoint(e.touches);
        setOriginFromPoint(mid.x, mid.y);
      }
    }

    function handleTouchMove(e) {
      if (e.touches.length === 2 && pinchRef.current.distance) {
        e.preventDefault();
        const newDistance = getDistance(e.touches);
        const scaleFactor = newDistance / pinchRef.current.distance;
        const next = pinchRef.current.startZoom * scaleFactor;
        setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
      }
    }

    function handleTouchEnd(e) {
      if (e.touches.length < 2) {
        pinchRef.current.distance = null;
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch('/api/board', { cache: 'no-store' });
      const data = await res.json();
      const next = new Array(TOTAL).fill(null);
      (data.cells || []).forEach((c) => {
        next[c.index] = { color: c.color, owner: c.owner };
      });
      setBoard(next);
      setRecentSales(data.recentSales || []);
    } catch (err) {
      console.error(err);
      showToast('No se pudo cargar el mural. Recargá la página.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      setStatusBanner('¡Pago aprobado! Puede tardar unos segundos en pintarse — dale a recargar si no la ves todavía.');
    } else if (status === 'pending') {
      setStatusBanner('Tu pago está pendiente de confirmación.');
    } else if (status === 'failure') {
      setStatusBanner('El pago no se completó. Podés intentar de nuevo.');
    }
    if (status) {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(loadBoard, 3000);
    }
  }, [loadBoard]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function toggleCell(i) {
    if (board[i]) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function handlePay() {
    if (selected.size === 0) return;
    setPaying(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indices: Array.from(selected),
          color,
          owner: owner.trim().slice(0, 18),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'No se pudo iniciar el pago.');
        setPaying(false);
        return;
      }
      window.location.href = data.initPoint;
    } catch (err) {
      console.error(err);
      showToast('No se pudo conectar con Mercado Pago.');
      setPaying(false);
    }
  }

  const soldCount = board.filter(Boolean).length;
  const raised = soldCount * PRICE;

  return (
    <>
      <div className="header">
        <div className="header-top">
          <div className="logo">
            PIXEL<span>DECK</span>
          </div>
          <div className="tagline">
            {TOTAL} celdas · ${PRICE} c/u · pagá con Mercado Pago y pintá la tuya
          </div>
        </div>
        <div className="ticker-wrap">
          <div className="ticker-track">
            {recentSales.length === 0
              ? `Sé la primera persona en pintar un píxel — $${PRICE} por celda.`
              : recentSales.map((s, idx) => (
                  <span key={idx}>
                    {s.owner || 'anónimo'} pintó {indexToCoord(s.index)} por <b>${PRICE}</b>
                    {idx < recentSales.length - 1 && <span className="dot">•</span>}
                  </span>
                ))}
          </div>
        </div>
      </div>

      <main>
        {statusBanner && <div className="status-banner">{statusBanner}</div>}

        <div className={`board-frame ${loading ? 'loading' : ''}`} ref={boardFrameRef}>
          <div
            id="board"
            ref={boardRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: `${origin.x} ${origin.y}` }}
          >
            {board.map((state, i) => (
              <div
                key={i}
                className={`cell ${state ? 'sold' : ''} ${selected.has(i) ? 'selected' : ''}`}
                style={{ background: state ? state.color : undefined }}
                onClick={() => toggleCell(i)}
                title={
                  state
                    ? `${indexToCoord(i)} · ${state.owner || 'anónimo'}`
                    : `${indexToCoord(i)} · $${PRICE}`
                }
              />
            ))}
          </div>
          {loading && <div className="loading-msg">Cargando el mural…</div>}
        </div>

        <div className="stats">
          <span>
            vendidas <b>{soldCount}</b> / {TOTAL}
          </span>
          <span className="raised">
            recaudado <b>${raised}</b>
          </span>
        </div>

        <div className="legend">
          Elegí celdas vacías tocándolas, poné tu color y tu nombre, y pagá con Mercado Pago para
          pintarlas. La celda se pinta sola apenas se confirma el pago.
        </div>
      </main>

      <div className={`buybar ${selected.size > 0 ? 'open' : ''}`}>
        <div className="count">
          {selected.size} celdas · <b>${selected.size * PRICE}</b>
        </div>
        <div className="field">
          <label>COLOR</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="field">
          <label>NOMBRE (OPCIONAL)</label>
          <input
            type="text"
            maxLength={18}
            placeholder="anónimo"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
        </div>
        <button className="clear-btn" onClick={() => setSelected(new Set())}>
          Vaciar selección
        </button>
        <button className="buy-btn" disabled={paying} onClick={handlePay}>
          {paying ? 'Redirigiendo…' : 'Pagar con Mercado Pago'}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <footer>
        Los píxeles se pintan automáticamente cuando Mercado Pago confirma el pago —
        no hace falta recargar, aunque a veces tarda unos segundos.
      </footer>
    </>
  );
}
