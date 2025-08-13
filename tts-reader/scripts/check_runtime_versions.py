import importlib

modules = [
    "fastapi",
    "uvicorn",
    "wsproto",
    "uvloop",
    "pydantic",
    "numpy",
]

for name in modules:
    try:
        module = importlib.import_module(name)
        version = getattr(module, "__version__", "unknown")
        print(f"{name} {version}")
    except Exception as e:
        print(f"{name} missing: {e}")
