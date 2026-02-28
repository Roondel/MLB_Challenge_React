import { useRef, useState, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { compressToBlob } from '../../services/imageUtils';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';

// currentKey — existing S3 key (e.g. "photos/109/photo.jpg"), legacy base64, or null
// onChange   — called with a Blob when user picks a file, or null when they clear it
export default function PhotoUploader({ currentKey, onChange }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState(null);

  // Resolve S3 key to pre-signed URL (hook returns null for base64/null inputs)
  const isBase64 = currentKey?.startsWith('data:image/');
  const resolvedS3Url = usePhotoUrl(!isBase64 ? currentKey : null);

  // Priority: newly picked file preview > legacy base64 > resolved S3 URL
  const previewSrc = previewObjectUrl ?? (isBase64 ? currentKey : null) ?? resolvedS3Url;

  // Revoke object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const blob = await compressToBlob(file);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(URL.createObjectURL(blob));
      onChange(blob);
    } catch {
      alert('Failed to process image. Please try another file.');
    } finally {
      setLoading(false);
      // Reset input so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = () => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
    onChange(null);
  };

  if (previewSrc) {
    return (
      <div className="relative group">
        <img
          src={previewSrc}
          alt="Baseball"
          className="w-full h-48 object-cover rounded-lg"
        />
        <button
          type="button"
          onClick={handleClear}
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
