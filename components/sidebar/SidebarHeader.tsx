import React from 'react';

interface SidebarHeaderProps {
  totalMinted: number;
  canvasWidth: number;
  canvasHeight: number;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

export default function SidebarHeader({
  totalMinted,
  canvasWidth,
  canvasHeight,
  onClose,
  onDragStart,
  onTouchStart,
}: SidebarHeaderProps) {
  return (
    <div
      className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={onDragStart}
      onTouchStart={onTouchStart}
      style={{ touchAction: "none" }}
    >
      <div>
        <h2 className="text-lg font-semibold">🎨 Pixel Canvas</h2>
        <div className="text-sm text-gray-300">
          {canvasWidth * canvasHeight} pixels • {totalMinted} minted
        </div>
      </div>

      <button
        onClick={onClose}
        className="text-gray-400 hover:text-white text-xl"
      >
        ✕
      </button>
    </div>
  );
}
