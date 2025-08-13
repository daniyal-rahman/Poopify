from abc import ABC, abstractmethod
import numpy as np

class TTSProvider(ABC):
        """
            A provider returns PCM16 mono at 48kHz, 1-D np.int16 array.
            Raise RateLimitedError on 429-like conditions.
            """

        @abstractmethod
        def synth(self, text: str, voice: str = "default") -> np.ndarray:
            raise NotImplementedError

