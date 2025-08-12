import React, { useState } from 'react';
import { api } from '../api';

interface UploadProps {
  onParseComplete: (doc: any) => void;
}

const Upload: React.FC<UploadProps> = ({ onParseComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    setError(null);

    try {
      const fileId = await api.uploadFile(selectedFile);
      const parsedDoc = await api.parseFile(fileId, 'academic', false);
      onParseComplete(parsedDoc);
    } catch (err) {
      setError('Failed to upload or parse the file.');
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div>
      <h2>Upload a PDF</h2>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!selectedFile || isParsing}>
        {isParsing ? 'Parsing...' : 'Upload and Parse'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default Upload;
