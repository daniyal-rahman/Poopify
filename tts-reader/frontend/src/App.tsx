import React, { useState } from 'react';
import Upload from './components/Upload';
import Reader from './components/Reader';
import './App.css';

function App() {
  const [doc, setDoc] = useState(null);

  const handleParseComplete = (parsedDoc) => {
    setDoc(parsedDoc);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Layout-Aware TTS Reader</h1>
      </header>
      <main>
        {!doc ? (
          <Upload onParseComplete={handleParseComplete} />
        ) : (
          <Reader doc={doc} />
        )}
      </main>
    </div>
  );
}

export default App;
