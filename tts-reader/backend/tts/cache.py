import os
import hashlib
import numpy as np
from typing import Optional

_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache", "audio")
os.makedirs(_CACHE_DIR, exist_ok=True)

def _key(text: str, voice: str = "default") -> str:
    h = hashlib.sha1()
    h.update(text.strip().encode("utf-8"))
    h.update(b"|")
    h.update(voice.encode("utf-8"))
    return h.hexdigest()

def get(text: str, voice: str = "default") -> Optional[np.ndarray]:
    path = os.path.join(_CACHE_DIR, f"{_key(text, voice)}.npy")
    if not os.path.exists(path):
        return None
    try:
        arr = np.load(path)
        if isinstance(arr, np.ndarray) and arr.dtype == np.int16:
            return arr
    except Exception:
        pass
    return None

def put(text: str, pcm_int16: np.ndarray, voice: str = "default") -> None:
    if pcm_int16 is None or pcm_int16.size == 0:
        return
    path = os.path.join(_CACHE_DIR, f"{_key(text, voice)}.npy")
    tmp = path + ".tmp"
    try:
        np.save(tmp, pcm_int16.astype(np.int16), allow_pickle=False)
        os.replace(tmp, path)
    except Exception:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass
