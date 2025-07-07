import React from 'react';

interface ColorPaletteProps {
  colorPalette: string[];
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  customHexColor: string;
  setCustomHexColor: (color: string) => void;
  showHexInput: boolean;
  setShowHexInput: (show: boolean) => void;
  applyHexColor: () => void;
  handleHexKeyPress: (e: React.KeyboardEvent) => void;
}

export default function ColorPalette({
  colorPalette,
  selectedColor,
  setSelectedColor,
  customHexColor,
  setCustomHexColor,
  showHexInput,
  setShowHexInput,
  applyHexColor,
  handleHexKeyPress,
}: ColorPaletteProps) {
  return (
    <div className="p-6 border-b border-gray-700">
      <h3 className="text-lg font-semibold mb-4">🎨 Color Palette</h3>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {colorPalette.map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            className={`w-12 h-12 rounded-lg border-2 transition-all ${
              selectedColor === color
                ? "border-yellow-400 scale-110 shadow-lg"
                : "border-gray-600 hover:border-gray-500"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Custom Color Options */}
      <div className="space-y-3">
        {/* Color Picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Picker:</label>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="w-10 h-8 rounded cursor-pointer"
            title="Color Picker"
          />
          <span className="text-xs text-gray-400 font-mono">
            {selectedColor}
          </span>
        </div>

        {/* Hex Input */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Hex:</label>
          {showHexInput ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={customHexColor}
                onChange={(e) => setCustomHexColor(e.target.value)}
                onKeyDown={handleHexKeyPress}
                placeholder="#FF0000"
                className="flex-1 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600 outline-none focus:border-blue-500"
                maxLength={7}
                autoFocus
              />
              <button
                onClick={applyHexColor}
                className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs transition-colors"
                title="Apply Color"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setCustomHexColor("");
                  setShowHexInput(false);
                }}
                className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs transition-colors"
                title="Cancel"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowHexInput(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
              title="Enter Hex Color"
            >
              # Enter Hex
            </button>
          )}
        </div>

        {/* Current Selected Color Display */}
        <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
          <span className="text-sm text-gray-400">Selected:</span>
          <div
            className="w-6 h-6 border border-gray-600 rounded"
            style={{ backgroundColor: selectedColor }}
          ></div>
          <span className="text-xs text-gray-300 font-mono">
            {selectedColor}
          </span>
        </div>
      </div>
    </div>
  );
}
