import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  totalPages: number;
}

export function ZoomControls({ totalPages }: Props) {
  const [zoom, setZoom] = useState(100);

  const handleZoom = (newZoom: number) => {
    const clamped = Math.min(Math.max(newZoom, 50), 150);
    setZoom(clamped);
    const elem = document.getElementById("document-pages");
    if (elem) {
      elem.style.transform = `scale(${clamped / 100})`;
      elem.style.transformOrigin = "top center";
    }
  };

  const jumpToPage = (pageNum: number) => {
    const pageElem = document.getElementById(`paper-page-${pageNum}`);
    if (pageElem) {
      pageElem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        backgroundColor: "#1e293b",
        color: "#ffffff",
        padding: "8px 14px",
        borderRadius: "30px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
      }}
    >
      {/* پیج سلیکٹر */}
      <select
        onChange={(e) => jumpToPage(Number(e.target.value))}
        style={{
          background: "#0f172a",
          color: "#fff",
          border: "1px solid #334155",
          borderRadius: "6px",
          padding: "4px 8px",
          fontSize: "12px",
          outline: "none"
        }}
      >
        {Array.from({ length: totalPages }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            Page {i + 1}
          </option>
        ))}
      </select>

      <div style={{ width: "1px", height: "16px", backgroundColor: "#334155" }} />

      {/* زوم آؤٹ */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => handleZoom(zoom - 10)}
        style={{ color: "#fff", height: "28px", width: "28px" }}
      >
        <ZoomOut size={16} />
      </Button>

      <span style={{ fontSize: "12px", fontWeight: "bold", minWidth: "40px", textAlign: "center" }}>
        {zoom}%
      </span>

      {/* زوم ان */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => handleZoom(zoom + 10)}
        style={{ color: "#fff", height: "28px", width: "28px" }}
      >
        <ZoomIn size={16} />
      </Button>

      {/* ری سیٹ زوم */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => handleZoom(100)}
        style={{ color: "#fff", height: "28px", width: "28px" }}
        title="Reset Zoom"
      >
        <RotateCcw size={14} />
      </Button>
    </div>
  );
}
