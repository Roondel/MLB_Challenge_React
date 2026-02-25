import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { compressImage } from '../../services/imageUtils';

export default function PhotoUploader({ value, onChange }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch {
      alert('Failed to process image. Please try another file.');
    } finally {
      setLoading(false);
    }
  };

  if (value) {
    return (
      <div className="relative group">
        <img
          src={value}
          alt="Baseball"
          className="w-full h-48 object-cover rounded-lg"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 p-1 bg-dark-900/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={loading}
      className="w-full h-48 border-2 border-dashed border-dark-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-accent/50 hover:bg-dark-700/30 transition-colors"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {loading ? (
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      ) : (
        <>
          <Camera size={24} className="text-gray-500" />
          <span className="text-sm text-gray-500">Upload baseball photo</span>
        </>
      )}
    </button>
  );
}
