const API_PREFIX = 'http://localhost:8000/api';

export const api = {
  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_PREFIX}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    const result = await response.json();
    return result.file_id;
  },

  async parseFile(fileId: string, profile: string, includeCaptions: boolean): Promise<any> {
    const response = await fetch(`${API_PREFIX}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        profile,
        include_captions: includeCaptions,
      }),
    });

    if (!response.ok) {
      throw new Error('Parsing failed');
    }

    return response.json();
  },
};
