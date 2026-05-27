import { useRef, useState, useEffect } from 'react'
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const colors = [
  "#b91c1c", "#c2410c", "#b45309", "#15803d", "#047857",
  "#0f766e", "#0369a1", "#1d4ed8", "#4338ca", "#6d28d9",
  "#a21caf", "#be123c", "#7f1d1d", "#7c2d12", "#78350f",
  "#14532d", "#064e3b", "#134e4a", "#0c4a6e", "#1e3a8a",
  "#312e81", "#4c1d95", "#701a75", "#881337", "#991b1b",
  "#9a3412", "#92400e", "#166534", "#065f46", "#115e59"
];

const basicColors = [
  "#000000", "#ffffff", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#a16207", "#6b7280"
];

const highlighterColors = ["#FFFF00","#FF6EC7","#00FF00","#FF6600","#00FFFF"];

function Room({ onBack }) {
  const { handleSendMessage, messages, code, handleSocket, colorId, memberNames,
    handleDisconnect, host, setHost, canvasChange, preview, pencilWidth, setPencilWidth,
    pencilColor, setPencilColor, strokes, eraserWidth, setEraserWidth,
    highlighterColor, setHighlighterColor, highlighterWidth, setHighlighterWidth,
    undoStack, redoStack, handleUndo, handleRedo, handleClear, allowPencil,
    allowHighlighter, allowEraser, allowClear, updatePermission, tool, setTool} = useSocket();
  
  const { generateKey, username } = useAuth();
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [confirmPopup, setConfirmPopup] = useState(false);
  const [key, setKey] = useState('');
  const hasFetched = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(null);
  const hostHeading = host ? 'You are the Host' : '';
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(true);

  const pinchStartDist = useRef(null);
  const pinchStartZoom = useRef(1);
  const [isPinching, setIsPinching] = useState(false);

  const pencilWidthRef = useRef(pencilWidth);
  const pencilColorRef = useRef(pencilColor);
  const eraserWidthRef = useRef(eraserWidth);
  const highlighterWidthRef = useRef(highlighterWidth);
  const highlighterColorRef = useRef(highlighterColor);
  const toolRef = useRef(tool);
  const zoomRef = useRef(zoom);

  // CanvasReferences
  const canvasRef = useRef(null);
  const localCanvasRef = useRef(null);
  const ctxRef = useRef(null);
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastEmit = useRef(0);
  const previewStroke = useRef([]);
  const fullStroke = useRef([]);

  useEffect(() => { pencilWidthRef.current = pencilWidth; }, [pencilWidth]);
  useEffect(() => { pencilColorRef.current = pencilColor; }, [pencilColor]);
  useEffect(() => { eraserWidthRef.current = eraserWidth; }, [eraserWidth]);
  useEffect(() => { highlighterWidthRef.current = highlighterWidth; }, [highlighterWidth]);
  useEffect(() => { highlighterColorRef.current = highlighterColor; }, [highlighterColor]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  //Preview Canvas
  const previewCanvasRef = useRef(null);

  // To send text messages
  const handleMessage = () => {
    handleSendMessage(inputRef.current.value)
    inputRef.current.value = '';
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(key);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 3000)
  }

  // Generates or displays room id
  useEffect(() => {
    const fetchKey = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;
      const user = JSON.parse(sessionStorage.getItem('user'));
      if (user.title === 'host') {
        try {
          setLoading(true);
          const response = await generateKey();
          setKey(response);
          handleSocket(response);
          setHost(true);
        }
        catch (err) {
          console.error(err);
        }
        finally {
          setLoading(false);
        }
      }
      else { setKey(code); }
      
    }
    fetchKey();
  }
    , [code, generateKey, handleSocket, setHost]);

  // Displays preview strokes received from server
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const points = preview.points

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!preview || !preview.points || preview.points.length === 0) return;

    const isH = preview.tool === 'highlighter';
    ctx.strokeStyle = preview.color;
    ctx.lineWidth = preview.width;
    ctx.globalAlpha = isH ? 0.3 : 1;
    ctx.globalCompositeOperation = isH ? 'multiply' : 'source-over';
    ctx.lineCap = isH ? 'square' : 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((point) => { ctx.lineTo(point.x, point.y) });
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    
  }, [preview])

  // Displays the full committed Strokes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    const sortedStrokes = [...strokes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    sortedStrokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length < 1) return;
      const isH = stroke.tool === 'highlighter';
      ctx.globalAlpha = isH ? 0.3 : 1;
      ctx.globalCompositeOperation = isH ? 'multiply' : 'source-over';
      ctx.beginPath();
      ctx.lineCap = isH ? 'square' : 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
  }, [strokes]);

  const getPos = (e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const source = e.touches ? e.touches[0] : e;
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (source.clientX - rect.left) * scaleX;
    const y = (source.clientY - rect.top) * scaleY;
    return { x, y };
  };

  // Handles Drawing
  const startDrawing = (e) => {
    const currentTool = toolRef.current;
    if (currentTool !== 'pencil' && currentTool !== 'highlighter') return;

    const canvas = localCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const isH = currentTool === 'highlighter';

    ctx.strokeStyle = isH ? highlighterColorRef.current : pencilColorRef.current;
    ctx.lineWidth   = isH ? highlighterWidthRef.current : pencilWidthRef.current;
    ctx.globalAlpha = isH ? 0.3 : 1;
    ctx.globalCompositeOperation = isH ? 'multiply' : 'source-over';
    ctx.lineCap  = isH ? 'square' : 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    ctxRef.current = ctx;

    isDrawing.current = true;
    lastPos.current = getPos(e);
    previewStroke.current = [lastPos.current];
    fullStroke.current = [lastPos.current];
    draw(e);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    const currentTool = toolRef.current;
    if (currentTool !== 'pencil' && currentTool !== 'highlighter') return;
    e.preventDefault();

    const isH = currentTool === 'highlighter';
    const ctx = ctxRef.current;
    const canvas = localCanvasRef.current;
    const pos = getPos(e);

    previewStroke.current.push(pos);
    fullStroke.current.push(pos);
    lastPos.current = pos;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(fullStroke.current[0].x, fullStroke.current[0].y);
    fullStroke.current.forEach((point) => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    if (memberNames.length < 6) {
      const now = Date.now();
      if (now - lastEmit.current >= 100) {
        const stroke = {
          type: 'preview',
          tool: currentTool,
          width: isH ? highlighterWidthRef.current : pencilWidthRef.current,
          color: isH ? highlighterColorRef.current : pencilColorRef.current,
          points: previewStroke.current
        }
        canvasChange(stroke);
        previewStroke.current = [previewStroke.current.at(-1)];
        lastEmit.current = now;
      }
    }
  };

  const stopDrawing = () => {
    const currentTool = toolRef.current;
    if (currentTool !== 'pencil' && currentTool !== 'highlighter') return;
    isDrawing.current = false;
    if (fullStroke.current.length < 2) return;

    ctxRef.current = null;
    const canvas = localCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isH = currentTool === 'highlighter';

    const stroke = {
      type: 'fullStroke',
      id: crypto.randomUUID(),
      clientId: username,
      tool: currentTool,
      width: isH ? highlighterWidthRef.current : pencilWidthRef.current,
      color: isH ? highlighterColorRef.current : pencilColorRef.current,
      points: fullStroke.current,
      timestamp: Date.now()
    }

    canvasChange(stroke);
    canvasChange({ type: 'preview', points: [] });
    fullStroke.current = [];
  };

  // Handle Eraser
  
  const startErasing = (e) => {
    if (toolRef.current !== 'eraser') return;
    isErasing.current = true;
    lastPos.current = getPos(e);

    const canvas = localCanvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = eraserWidthRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    ctxRef.current = ctx;

    previewStroke.current = [lastPos.current];
    fullStroke.current = [lastPos.current];
    erase(e);
  };

  const erase = (e) => {
    if (!isErasing.current || toolRef.current !== 'eraser') return;
    const pos = getPos(e);

    const ctx = ctxRef.current;

    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    previewStroke.current.push(pos);
    fullStroke.current.push(pos);
    lastPos.current = pos;

    if (memberNames.length < 6) {
      const now = Date.now();
      if (now - lastEmit.current >= 100) {
        canvasChange({
          type: 'preview',
          tool: 'eraser',
          width: eraserWidthRef.current,
          color: '#ffffff',
          points: previewStroke.current
        });
        previewStroke.current = [previewStroke.current.at(-1)];
        lastEmit.current = now;
      }
    }
  };

  const stopErasing = () => {
    if (!isErasing.current) return;
    isErasing.current = false;
    if (fullStroke.current.length < 2) return;

    ctxRef.current = null;
    const canvas = localCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    canvasChange({
      type: 'fullStroke',
      id: crypto.randomUUID(),
      clientId: username,
      tool: 'eraser',
      color: '#ffffff',
      width: eraserWidthRef.current,
      points: fullStroke.current,
      timestamp: Date.now()
    });
    canvasChange({ type: 'preview', points: [] });
    fullStroke.current = [];
  };

  useEffect(() => {
    if (tool === 'pencil' && allowPencil === false) {
      if (isDrawing.current === true) {
        stopDrawing();
      }
      setTool('drag');
    }
    if (tool === 'highlighter' && allowHighlighter === false) {
      if (isDrawing.current === true) {
        stopDrawing();
      }
      setTool('drag');
    }
    if (tool === 'eraser' && allowEraser === false) {
      if (isErasing.current === true) {
        stopErasing();
      }
      setTool('drag');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowPencil, allowHighlighter, allowEraser, tool]);
  
  // Set canvas dimensions
  useEffect(() => {
    canvasRef.current.width = 4000;
    canvasRef.current.height = 3000;
    previewCanvasRef.current.width = 4000;
    previewCanvasRef.current.height = 3000;
    localCanvasRef.current.width = 4000;
    localCanvasRef.current.height = 3000;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e) => {
      setHovered(null);
      const t = toolRef.current;
      if (t === 'pencil' || t === 'highlighter' || t === 'eraser') {
        if (e.touches.length === 1) {
          e.preventDefault();
          if (t === 'pencil' || t === 'highlighter') startDrawing(e);
          if (t === 'eraser') startErasing(e);
        }
      }
    };

    const handleTouchMove = (e) => {
      const t = toolRef.current;
      if (t === 'pencil' || t === 'highlighter' || t === 'eraser') {
        if (e.touches.length === 1) {
          e.preventDefault();
          if (t === 'pencil' || t === 'highlighter') draw(e);
          if (t === 'eraser') erase(e);
        }
      }
    };

    const handleTouchEnd = () => {
      const t = toolRef.current;
      if (t === 'pencil' || t === 'highlighter') stopDrawing();
      if (t === 'eraser') stopErasing();
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.1, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  };

  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleMouseDown = (e) => {
    if (tool === 'drag'){
    setDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
    }
  };

  // attaches scroll event to container on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });

    const handlePinchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        if (isDrawing.current) stopDrawing();
        if (isErasing.current) stopErasing();
        setIsPinching(true);
        pinchStartDist.current = getTouchDistance(e.touches);
        pinchStartZoom.current = zoomRef.current;
      }
    };

    const handlePinchMove = (e) => {
      if (e.touches.length === 2 && pinchStartDist.current !== null) {
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches);
        const scale = currentDist / pinchStartDist.current;
        const newZoom = Math.min(3, Math.max(0.1, pinchStartZoom.current * scale));
        setZoom(newZoom);
      }
    };

    const handlePinchEnd = (e) => {
      if (e.touches.length < 2) {
        pinchStartDist.current = null;
        setIsPinching(false);
      }
    };

    container.addEventListener('touchstart', handlePinchStart, { passive: false });
    container.addEventListener('touchmove', handlePinchMove, { passive: false });
    container.addEventListener('touchend', handlePinchEnd, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handlePinchStart);
      container.removeEventListener('touchmove', handlePinchMove);
      container.removeEventListener('touchend', handlePinchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Updates when dragging changes to reflect drag
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e) => {
      if (e.touches) {
        e.preventDefault();
      }
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPan({ x: clientX - dragStart.x, y: clientY - dragStart.y });
    };

    const handleMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [dragging, dragStart]);

  
  const toggleTool = (arg) => {
    setTool(arg)
  }

  // Tool Menus
  const pencilMenu = () => {
    return (
      <div className=' bg-white rounded-xl shadow-lg px-4 py-3 w-52 flex flex-col gap-3 border border-slate-200 '>
        
        <div className='flex justify-between items-center'>
          <span className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>Brush Size</span>
          <span className='text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md'>{pencilWidth}px</span>
        </div>
        <input
          type='range'
          min='1'
          max='250'
          value={pencilWidth}
          onChange={(e) => setPencilWidth(Number(e.target.value))}
          className='w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-slate-700'
        />
        <div className='flex justify-between text-[10px] text-slate-400'>
          <span>1</span>
          <span>250</span>
        </div>
    
        <span className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>Color</span>
        <div className='grid grid-cols-6 gap-2'>
          {basicColors.map((color) => (
            <div
              key={color}
              onClick={() => setPencilColor(color)}
              className='w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform'
              style={{
                backgroundColor: color,
                border: pencilColor === color ? '2px solid #3b82f6' : '2px solid transparent',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}
            />
          ))}
        </div>
    
      </div>
    )
  }

  const eraserMenu = () => {
    return (
      <div className=' bg-white rounded-xl shadow-lg px-4 py-3 w-52 flex flex-col gap-3 border border-slate-200 '>
        <div className='flex justify-between items-center'>
        <span className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>Eraser Size</span>
        <span className='text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md'>{eraserWidth}px</span>
      </div>
      <input
        type='range'
        min='1'
        max='250'
        value={eraserWidth}
        onChange={(e) => setEraserWidth(Number(e.target.value))}
        className='w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-slate-700'
      />
      <div className='flex justify-between text-[10px] text-slate-400'>
        <span>1</span>
        <span>250</span>
        </div>
      </div>
    )
  }

  const highlighterMenu = () => {
    return (
      <div className=' bg-white rounded-xl shadow-lg px-4 py-3 w-52 flex flex-col gap-3 border border-slate-200 '>
        
        <div className='flex justify-between items-center'>
          <span className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>Highlighter Size</span>
          <span className='text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md'>{highlighterWidth}px</span>
        </div>
        <input
          type='range'
          min='1'
          max='250'
          value={highlighterWidth}
          onChange={(e) => setHighlighterWidth(Number(e.target.value))}
          className='w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-slate-700'
        />
        <div className='flex justify-between text-[10px] text-slate-400'>
          <span>1</span>
          <span>250</span>
        </div>
    
        <span className='text-xs font-semibold text-slate-500 uppercase tracking-wide'>Color</span>
        <div className='grid grid-cols-6 gap-2'>
          {highlighterColors.map((color) => (
            <div
              key={color}
              onClick={() => setHighlighterColor(color)}
              className='w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform'
              style={{
                backgroundColor: color,
                border: highlighterColor === color ? '2px solid #3b82f6' : '2px solid transparent',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}
            />
          ))}
        </div>
    
      </div>
    )
  }
  
  // Exit Confirm Popup
  const popup = () => {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (user.title) {
      return <div className='confirmPopup' >
        <p className='text-sm md:text-2xl'>You are the Host, If you exit, a new Host will be choosen.<br />
          Are you Sure you want to Exit</p>
        <br />
        <button className='text-sm md:text-2xl bg-blue-300 px-2 hover:bg-blue-200 transition-all mr-4 md:mr-8'
          onClick={() => { setConfirmPopup(false) }}>No</button>
        <button className='text-sm md:text-2xl bg-red-300 px-2 hover:bg-red-200 transition-all mr-4 md:mr-8'
          onClick={() => {
            const existingUser = JSON.parse(sessionStorage.getItem('user'));
            delete existingUser.title;
            sessionStorage.setItem('user', JSON.stringify(existingUser));
            handleDisconnect();
            onBack();
          }}>Yes</button>
      </div>
    }
    return <div className='confirmPopup'><p className='text-sm md:text-2xl'>Are you Sure you want to Exit</p>
      <br />
      <button className='text-sm md:text-2xl bg-blue-300 px-2 hover:bg-blue-200 transition-all mr-4 md:mr-8'
        onClick={() => { setConfirmPopup(false) }}>No</button>
      <button className='text-sm md:text-2xl bg-red-300 px-2 hover:bg-red-200 transition-all mr-4 md:mr-8'
        onClick={onBack}>Yes</button>
    </div>
  }

  // The Component
  return (
    <div className='h-screen w-screen relative bg-slate-50 select-none'>
  
      <div className='absolute inset-0 overflow-hidden' style={{ zIndex: 0 }}>
        <div
          ref={containerRef}
          className="w-full h-full overflow-hidden relative bg-transparent select-none"
          style={{
            cursor: tool !== 'drag' ? 'default' : (dragging ? 'grabbing' : 'grab')
          }}
          onMouseDown={(e) => {
            setHovered(null);
            if (tool === 'drag') handleMouseDown(e);
          }}
          onTouchStart={(e) => {
            setHovered(null);
            if (tool === 'drag') handleMouseDown(e);
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute left-1/2 top-1/2 bg-white shadow-2xl rounded-sm border border-slate-200 select-none animate-none"
            style={{
              width: '4000px',
              height: '3000px',
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: (dragging || isPinching) ? 'none' : 'transform 0.15s ease-in-out',
            }}
            onMouseDown={(e) => {
              setHovered(null);
              if (tool === 'pencil' || tool === 'highlighter') startDrawing(e);
              else if (tool === 'eraser') startErasing(e);
            }}
            
            onMouseMove={(e) => {
              if (tool === 'pencil' || tool === 'highlighter') draw(e);
              else if (tool === 'eraser') erase(e);
            }}
            
            onMouseUp={() => {
              if (tool === 'pencil' || tool === 'highlighter') stopDrawing();
              else if (tool === 'eraser') stopErasing();
            }}
            
            onMouseLeave={() => {
              if (tool === 'pencil' || tool === 'highlighter') stopDrawing();
              else if (tool === 'eraser') stopErasing();
            }}
            
            onDoubleClick={(e) => e.preventDefault()}
          />
        </div>
        {/* Preview Canvas*/}
        <canvas
          ref={previewCanvasRef}
          className="absolute left-1/2 top-1/2"  // no bg-white, no shadow
          style={{
            width: '4000px',
            height: '3000px',
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: (dragging || isPinching) ? 'none' : 'transform 0.15s ease-in-out',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* Local Drawing Canvas */}
        <canvas
          ref={localCanvasRef}
          className="absolute left-1/2 top-1/2"
          style={{
            width: '4000px',
            height: '3000px',
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: (dragging || isPinching) ? 'none' : 'transform 0.15s ease-in-out',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />

        {/* Zoom Indicator */}
        <div
           className="fixed top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none"
           style={{ zIndex: 30 }}
         >
           {Math.round(zoom * 100)}%
         </div>
       
         {/* Fit button */}
         <button
           className="fixed top-2 right-14 bg-black/50 text-white text-xs px-2 py-1 rounded hover:bg-black/70"
           style={{ zIndex: 30 }}
           onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
         >
           Fit
         </button>
      </div>

      <div className="fixed flex flex-col gap-1 md:flex-row md:gap-2 top-1/2 -translate-y-1/2 right-1 md:translate-y-0 md:top-2 md:right-auto md:left-1/2 md:-translate-x-1/2 z-40 bg-white/95 backdrop-blur-md p-1 md:p-1.5 rounded-xl border border-slate-200 shadow-lg pointer-events-auto">

        <div className="relative">
          <button title="Drag" className={tool === 'drag' ? 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-blue-50 rounded-lg border-2 border-blue-500 pointer-events-auto shadow-sm' : 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm pointer-events-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed'}
            onClick={() => { toggleTool('drag'); setHovered(null); }}>🖱️</button>
        </div>

        <div className="relative">
          <button disabled={!allowPencil} className={tool === 'pencil' ? 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-blue-50 rounded-lg border-2 border-blue-500 pointer-events-auto shadow-sm' : 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm pointer-events-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed'}
            onClick={() => {
              if (tool === 'pencil') {
                setHovered(hovered === 'pencil' ? null : 'pencil');
              } else {
                toggleTool('pencil');
                setHovered('pencil');
              }
            }}>✏️</button>
          {hovered === 'pencil' && (
            <div className="absolute right-full top-0 mr-2 md:right-auto md:top-12 md:left-1/2 md:-translate-x-1/2 md:mr-0 md:mt-2 z-50 shadow-xl">
              {pencilMenu()}
            </div>
          )}
        </div>

        <div className="relative">
          <button disabled={!allowEraser} className={tool === 'eraser' ? 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-blue-50 rounded-lg border-2 border-blue-500 pointer-events-auto shadow-sm' : 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm pointer-events-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed'}
            onClick={() => {
              if (tool === 'eraser') {
                setHovered(hovered === 'eraser' ? null : 'eraser');
              } else {
                toggleTool('eraser');
                setHovered('eraser');
              }
            }}>🧽</button>
          {hovered === 'eraser' && (
            <div className="absolute right-full top-0 mr-2 md:right-auto md:top-12 md:left-1/2 md:-translate-x-1/2 md:mr-0 md:mt-2 z-50 shadow-xl">
              {eraserMenu()}
            </div>
          )}
        </div>

        <div className="relative">
          <button disabled={!allowHighlighter} className={tool === 'highlighter' ? 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-blue-50 rounded-lg border-2 border-blue-500 pointer-events-auto shadow-sm' : 'text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm pointer-events-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed'}
            onClick={() => {
              if (tool === 'highlighter') {
                setHovered(hovered === 'highlighter' ? null : 'highlighter');
              } else {
                toggleTool('highlighter');
                setHovered('highlighter');
              }
            }}>🖍️</button>
          {hovered === 'highlighter' && (
            <div className="absolute right-full top-0 mr-2 md:right-auto md:top-12 md:left-1/2 md:-translate-x-1/2 md:mr-0 md:mt-2 z-50 shadow-xl">
              {highlighterMenu()}
            </div>
          )}
        </div>

        <div>
          <button title="Undo" disabled={undoStack.length === 0} className="text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => { handleUndo(); setHovered(null); }}>⏪</button>
        </div>

        <div>
          <button title="Redo" disabled={redoStack.length === 0} className="text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => { handleRedo(); setHovered(null); }}>⏩</button>
        </div>

        <div>
          <button title="Clear" disabled={!allowClear} className="text-sm md:text-xl h-7 w-7 md:h-10 md:w-10 flex items-center justify-center bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => { handleClear(); setHovered(null); }}>🗑️</button>
        </div>

      </div>
  
      {/* Overlay */}
      <div className='fixed inset-0 pointer-events-none' style={{ zIndex: 10 }}>
  
        <div className='pointer-events-none mt-1'>
          <button className='pointer-events-auto font-bold text-xs md:text-2xl bg-red-500 hover:bg-red-400 active:bg-red-600 rounded-lg transition-all mx-2 md:mx-4 my-1 md:my-2 px-2 md:px-4'
            onClick={() => { setConfirmPopup(true); }}>Go Back</button>

          <h2 className='text-[10px] md:text-[16px] font-bold ml-2 md:ml-4 mt-1 md:mt-3 text-black'>{hostHeading}</h2>
          <h3 className='font-bold text-[10px] md:text-[16px] ml-2 md:ml-4 mt-1 md:mt-2 mb-1 md:mb-4 text-black flex items-center gap-1'>{loading ? 'Loading...' : `ID: ${key}`}
            <button onClick={handleCopy} className='pointer-events-auto select-auto inline-flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 rounded p-0.5 md:p-1 ml-1 shadow-sm text-[10px] md:text-base' title='Copy ID'>📃</button>
            {copied && (
                <span className='ml-1 text-[8px] md:text-xs text-green-600 font-medium bg-green-50 px-1 md:px-2 py-0.5 rounded border border-green-200/50'>
                  Copied!
                </span>
              )}
          </h3>

          <div className='flex mb-1 md:mb-3 ml-1 md:ml-2'>
            <p className='text-[10px] md:text-sm font-semibold bg-white border border-slate-200 shadow-sm rounded px-1.5 md:px-3 py-0.5 md:py-1 flex items-center'
              style={{ color: colors[colorId - 1] }}>
              {username ? username : ''}</p>
          </div>
  
          {memberNames.map((object, index) => {
            const isCurrentUserHost = JSON.parse(sessionStorage.getItem('user'))?.title === 'host';
            
            return (
              <div onMouseEnter={() => { if (isCurrentUserHost) setHovered('permissions');}} onMouseLeave={()=>{setHovered(null)}} key={index} className='relative flex w-fit pointer-events-auto mb-1 md:mb-3 ml-1 md:ml-2'>
              <p className='text-[10px] md:text-sm font-semibold bg-white border border-slate-200 shadow-sm rounded px-1.5 md:px-3 py-0.5 md:py-1 flex items-center'
                style={{ color: colors[object.color - 1] }}>
                  {object.isHost ? `👑 ${object.name}` : object.name}</p>
                
                {/* host menu on hover if user is host */}
                {hovered === 'permissions' && (
                        <div className='absolute left-[75px] top-0 ml-2 bg-white border border-slate-200 rounded-md p-2 shadow-xl z-50 flex-col gap-1 flex min-w-[180px]'>
                          <p className='text-[10px] flex justify-center text-slate-500 uppercase font-bold px-1 border-b border-slate-200 pb-1 mb-1'>
                            Permissions
                          </p>
                          <button onClick={() => updatePermission({
                            type: 'updatePermission',
                            targetName: object.name,
                            permission: 'allowPencil',
                            value: !object.allowPencil
                          })} className='text-xs text-slate-700 hover:text-white hover:bg-blue-600 px-2 py-1 rounded text-left transition-colors'>
                            {object.allowPencil ? '✏️ Disable Pencil ✔️' : '✏️ Enable Pencil ✖️'}
                          </button>

                          <button onClick={() => updatePermission({
                            type: 'updatePermission',
                            targetName: object.name,
                            permission: 'allowHighlighter',
                            value: !object.allowHighlighter
                          })} className='text-xs text-slate-700 hover:text-white hover:bg-blue-600 px-2 py-1 rounded text-left transition-colors'>
                            {object.allowHighlighter ? '🖍️ Disable Highlighter ✔️' : '🖍️ Enable Highlighter ✖️'}
                          </button>
                          
                          <button onClick={() => updatePermission({
                            type: 'updatePermission',
                            targetName: object.name,
                            permission: 'allowEraser',
                            value: !object.allowEraser
                          })} className='text-xs text-slate-700 hover:text-white hover:bg-blue-600 px-2 py-1 rounded text-left transition-colors'>
                            {object.allowEraser ? '🧽 Disable Eraser ✔️' : '🧽 Enable Eraser ✖️'}
                          </button>

                          <button onClick={() => updatePermission({
                            type: 'updatePermission',
                            targetName: object.name,
                            permission: 'allowClear',
                            value: !object.allowClear
                          })} className='text-xs text-slate-700 hover:text-white hover:bg-blue-600 px-2 py-1 rounded text-left transition-colors'>
                            {object.allowClear ? '🗑️ Disable Clear ✔️' : '🗑️ Enable Clear ✖️'}
                          </button>
                    
                          <button onClick={() => {
                            updatePermission({
                              type: 'kick',
                              targetName: object.name
                          })}} className='text-xs text-slate-700 hover:text-white hover:bg-red-600 px-2 py-1 rounded text-left transition-colors'>
                            🥾 Kick Member 
                          </button>
                        </div>
                      )}
              </div>)
          })}
        </div>
  
        {confirmPopup && <div className='pointer-events-auto'>{popup()}</div>}
  
        <div className='absolute bottom-[10px] right-[140px] md:right-[140px] pointer-events-auto'>
          <button
            className='hidden md:inline-block bg-slate-200 text-slate-700 hover:bg-slate-100 px-3 py-1 shadow-md text-sm font-bold transition-colors border-2 border-black'
            onClick={() => setShowChat(!showChat)}
          >
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </button>
          <button
            className='md:hidden h-8 w-8 rounded-full bg-slate-200 text-slate-700 shadow-md text-xs font-bold border-2 border-black flex items-center justify-center'
            onClick={() => setShowChat(!showChat)}
          >
            {showChat ? '✕' : '💬'}
          </button>
        </div>

        {showChat && (
          <div className='chat bg-white pointer-events-auto'>
            <h3 className='chatHeading'>/Chat/</h3>
            <ul className='chatList'>
              {messages.map((msg, index) => {
                return (
                  <li key={index} className='flex' style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    <span className='font-semibold text-sm mr-2 flex-shrink-0' style={{ color: colors[msg.id - 1] }}>{msg.name}:</span>
                    <span className='text-sm text-slate-800 break-words min-w-0'>{msg.text}</span>
                  </li>)
              })}
              <div ref={messagesEndRef} />
            </ul>
            <div className='flex mt-2'>
              <input className='font-mono border-black border-2 px-2 flex-grow min-w-0'
                type='text' ref={inputRef} id='roomInput' onKeyDown={(e) => { if (e.key === 'Enter') handleMessage() }}></input><span className='mx-1'>--</span>
              <button className='border-black border-2 bg-yellow-600 px-2 py-1 flex-shrink-0'
                onClick={handleMessage}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Room