import subprocess
import sys
import os
import time

def main():
    # Resolve absolute paths
    backend_path = os.path.abspath("superadmin_web/backend/app.py")
    frontend_dir = os.path.abspath("superadmin_web")
    
    print("=" * 60)
    print("Starting Jio Automation Concurrent Server...")
    print("=" * 60)
    
    # Launch Flask Backend
    print("[SYSTEM] Starting Flask backend...")
    backend_proc = subprocess.Popen([sys.executable, backend_path])
    
    # Launch Vite Frontend (shell=True is required for npm on Windows)
    print("[SYSTEM] Starting Vite frontend dev server...")
    frontend_proc = subprocess.Popen("npm run dev", cwd=frontend_dir, shell=True)
    
    try:
        while True:
            # Monitor processes
            if backend_proc.poll() is not None:
                print("[SYSTEM] Backend process terminated unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("[SYSTEM] Frontend process terminated unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[SYSTEM] KeyboardInterrupt received. Shutting down servers...")
    finally:
        # Gracefully terminate processes
        try:
            backend_proc.terminate()
            backend_proc.wait(timeout=2)
        except Exception:
            pass
            
        try:
            frontend_proc.terminate()
            frontend_proc.wait(timeout=2)
        except Exception:
            pass
            
        print("[SYSTEM] All servers stopped.")
        print("=" * 60)

if __name__ == "__main__":
    main()
