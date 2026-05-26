from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from models import db, User, SIMOrder, OTPMessage
import os
import sms_helper
from datetime import timedelta

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "../dist"))

BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"sqlite:///{os.path.join(BACKEND_DIR, 'database.db')}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = "super-secret-key-change-this"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
CORS(app, supports_credentials=True)

import queue
import threading
import time

db_lock = threading.RLock()


def commit_db():
    with db_lock:
        db.session.commit()


cancel_queue = queue.Queue()


def queue_cancellation(request_id, delay_seconds):
    cancel_time = time.time() + delay_seconds
    cancel_queue.put((request_id, cancel_time))


def cancel_worker():
    while True:
        try:
            item = cancel_queue.get(block=True)
            request_id, cancel_time = item

            now = time.time()
            if now < cancel_time:
                time.sleep(cancel_time - now)

            try:
                res = sms_helper.cancel_number(request_id)
                print(
                    f"[BACKGROUND] Auto-cancelled unregistered number request {request_id}: {res}"
                )
            except Exception as e:
                print(
                    f"[BACKGROUND] Error auto-cancelling number request {request_id}: {e}"
                )

            cancel_queue.task_done()
        except Exception as e:
            print(f"[BACKGROUND WORKER ERROR] {e}")
            time.sleep(1)


# Start worker thread
worker_thread = threading.Thread(target=cancel_worker, daemon=True)
worker_thread.start()

db.init_app(app)


def require_role(role):
    def decorator(f):
        def wrapped(*args, **kwargs):
            if "user_id" not in session:
                return jsonify({"error": "Unauthorized"}), 401
            user = User.query.get(session["user_id"])
            if not user or (user.role != role and user.role != "superadmin"):
                return jsonify({"error": "Forbidden"}), 403
            return f(*args, **kwargs)

        wrapped.__name__ = f.__name__
        return wrapped

    return decorator


def get_user_api_key():
    """Return the current user's personal API key, or None to use the global one."""
    user = User.query.get(session.get("user_id"))
    if user and user.api_key:
        return user.api_key
    return None


@app.route("/api/auth/api-key", methods=["GET"])
def get_own_api_key():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user = User.query.get(session["user_id"])
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"api_key": user.api_key or ""})


@app.route("/api/auth/api-key", methods=["PUT"])
def update_own_api_key():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user = User.query.get(session["user_id"])
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    if not data or "api_key" not in data:
        return jsonify({"error": "api_key required"}), 400
    user.api_key = data["api_key"] or None
    commit_db()
    return jsonify({"status": "saved", "api_key": user.api_key or ""})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get("username")).first()
    if user and user.check_password(data.get("password")):
        session.permanent = True  # Keep user logged in across restarts
        session["user_id"] = user.id
        session["role"] = user.role
        return jsonify({"user": user.to_dict()})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/auth/me", methods=["GET"])
def get_me():
    if "user_id" in session:
        user = User.query.get(session["user_id"])
        if user:
            return jsonify({"user": user.to_dict()})
    return jsonify({"user": None}), 401


@app.route("/api/users", methods=["GET"])
@require_role("admin")
def get_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])


@app.route("/api/users", methods=["POST"])
@require_role("superadmin")
def create_user():
    data = request.json
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username exists"}), 400

    new_user = User(username=data["username"], role=data.get("role", "user"))
    new_user.set_password(data["password"])
    db.session.add(new_user)
    commit_db()
    return jsonify(new_user.to_dict()), 201


@app.route("/api/users/<int:id>", methods=["PUT"])
@require_role("superadmin")
def update_user(id):
    user = User.query.get_or_404(id)
    data = request.json
    if "username" in data:
        user.username = data["username"]
    if "role" in data:
        user.role = data["role"]
    if "password" in data and data["password"]:
        user.set_password(data["password"])
    commit_db()
    return jsonify(user.to_dict())


@app.route("/api/users/<int:id>", methods=["DELETE"])
@require_role("superadmin")
def delete_user(id):
    user = User.query.get_or_404(id)
    db.session.delete(user)
    commit_db()
    return jsonify({"message": "User deleted"})


@app.route("/api/sms/balance", methods=["GET"])
def get_sms_balance():
    try:
        api_key = get_user_api_key()
        if not api_key:
            return jsonify(
                {
                    "error": "No personal API key set. Go to Settings > Your Personal API Key to configure one."
                }
            ), 400
        raw_bal = sms_helper.get_balance(api_key=api_key)
        parsed = sms_helper.parse_balance(raw_bal)
        return jsonify({"balance": parsed, "raw": raw_bal})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/price", methods=["GET"])
def get_sms_price():
    try:
        settings = sms_helper.load_settings()
        price = settings.get("price", "4.50")
        return jsonify({"price": price})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/request-number", methods=["POST"])
def request_sms_number():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        api_key = get_user_api_key()
        if not api_key:
            return jsonify(
                {
                    "error": "No personal API key set. Go to Settings > Your Personal API Key to configure one."
                }
            ), 400
        result = sms_helper.get_number(api_key=api_key)
        if not result:
            return jsonify(
                {"status": "no_number", "error": "Failed to get number from API"}
            ), 400

        request_id, phone_number = result

        # Check Jio registration status
        reg_status = sms_helper.check_registration_and_status(phone_number)

        if reg_status == "registered":
            # Save order to DB
            settings = sms_helper.load_settings()
            price_str = settings.get("price", "4.50")
            new_order = SIMOrder(
                user_id=session["user_id"],
                request_id=request_id,
                number=phone_number,
                status="active",
                price=price_str,
            )
            db.session.add(new_order)
            commit_db()

            return jsonify(
                {
                    "status": "registered",
                    "request_id": request_id,
                    "number": phone_number,
                    "price": price_str,
                }
            )
        else:
            # Queue background cancellation after allow cancel time to avoid blocking
            settings = sms_helper.load_settings()
            allow_cancel_time = int(settings.get("allow_cancel_time", 30))
            queue_cancellation(request_id, allow_cancel_time)

            return jsonify(
                {
                    "status": "not_registered",
                    "request_id": request_id,
                    "number": phone_number,
                    "jio_status": reg_status,
                }
            )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/otp-status/<request_id>", methods=["GET"])
def get_otp_status(request_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        api_key = get_user_api_key()
        if not api_key:
            return jsonify(
                {
                    "error": "No personal API key set. Go to Settings > Your Personal API Key to configure one."
                }
            ), 400
        response = sms_helper._http_get(
            {"action": "getStatus", "id": request_id}, api_key=api_key
        )
        status, otp = sms_helper.parse_otp_response(response)

        with db_lock:
            order = SIMOrder.query.filter_by(request_id=request_id).first()
            if order and order.user_id != session["user_id"]:
                return jsonify({"error": "Forbidden"}), 403

            if order:
                if status == "ok" and otp:
                    existing_msg = OTPMessage.query.filter_by(
                        order_id=order.id, otp=otp
                    ).first()
                    if not existing_msg:
                        new_msg = OTPMessage(order_id=order.id, otp=otp, text=response)
                        db.session.add(new_msg)
                        db.session.commit()
                elif status == "cancelled":
                    if order.status not in ("cancelled", "expired", "completed"):
                        order.status = (
                            "completed" if len(order.messages) > 0 else "cancelled"
                        )
                        db.session.commit()

        return jsonify({"status": status, "otp": otp, "raw": response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/next-otp/<request_id>", methods=["POST"])
def request_next_otp(request_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        api_key = get_user_api_key()
        if not api_key:
            return jsonify(
                {
                    "error": "No personal API key set. Go to Settings > Your Personal API Key to configure one."
                }
            ), 400

        with db_lock:
            order = SIMOrder.query.filter_by(request_id=request_id).first()
            if order and order.user_id != session["user_id"]:
                return jsonify({"error": "Forbidden"}), 403

            if order and order.status in ("cancelled", "expired"):
                return jsonify(
                    {"status": "rejected", "reason": "order_no_longer_active"}
                ), 400

            res = sms_helper.request_new_otp(request_id, api_key=api_key)

            if order:
                order.status = "active"
                db.session.commit()

        return jsonify({"status": "requested", "raw": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/cancel/<request_id>", methods=["POST"])
def cancel_sms_number(request_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        api_key = get_user_api_key()
        if not api_key:
            return jsonify(
                {
                    "error": "No personal API key set. Go to Settings > Your Personal API Key to configure one."
                }
            ), 400

        with db_lock:
            order = SIMOrder.query.filter_by(request_id=request_id).first()
            if order and order.user_id != session["user_id"]:
                return jsonify({"error": "Forbidden"}), 403

            if order and order.status not in ("cancelled", "expired", "completed"):
                res = sms_helper.cancel_number(request_id, api_key=api_key)
                parsed = sms_helper.parse_cancel_status(res)
                order.status = "completed" if len(order.messages) > 0 else "cancelled"
                db.session.commit()
            else:
                res = ""
                parsed = "already_cancelled"

        return jsonify({"status": "cancelled", "result": parsed, "raw": res})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/expire/<request_id>", methods=["POST"])
def expire_sms_number(request_id):
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        with db_lock:
            order = SIMOrder.query.filter_by(request_id=request_id).first()
            if order and order.user_id != session["user_id"]:
                return jsonify({"error": "Forbidden"}), 403

            if order:
                if order.status not in ("cancelled", "expired", "completed"):
                    order.status = "completed" if len(order.messages) > 0 else "expired"
                    db.session.commit()
                return jsonify({"status": "updated", "order_status": order.status})
            return jsonify({"error": "Order not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/orders", methods=["GET"])
def get_sms_orders():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        orders = (
            SIMOrder.query.filter_by(user_id=session["user_id"])
            .order_by(SIMOrder.created_at.desc())
            .all()
        )
        return jsonify([o.to_dict() for o in orders])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/settings", methods=["GET"])
def get_sms_settings():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        return jsonify(sms_helper.load_settings())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sms/settings", methods=["POST"])
def save_sms_settings():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user = User.query.get(session["user_id"])
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    if user.role not in ["admin", "superadmin"]:
        return jsonify({"error": "Forbidden"}), 403

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Enforce that only superadmin can change 'price'
        if user.role != "superadmin":
            current = sms_helper.load_settings()
            data["price"] = current.get("price", "4.50")

        sms_helper.save_settings(data)
        return jsonify({"status": "saved", "settings": sms_helper.load_settings()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Serve React frontend (must be last — catch-all for non-API routes)
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    file_path = os.path.join(FRONTEND_DIST, path)
    if path and os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIST, path)
    return send_from_directory(FRONTEND_DIST, "index.html")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        # Migration: add api_key column to existing database
        try:
            db.session.execute(
                db.text("ALTER TABLE user ADD COLUMN api_key VARCHAR(256)")
            )
            db.session.commit()
            print("[MIGRATION] Added api_key column to user table.")
        except Exception:
            db.session.rollback()  # Column already exists

        if not User.query.filter_by(username="superadmin").first():
            su = User(username="superadmin", role="superadmin")
            su.set_password("admin123")
            db.session.add(su)
            commit_db()
            print("Created default superadmin account: superadmin / admin123")
    app.run(port=5001, debug=True)
