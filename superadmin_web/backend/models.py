from flask_sqlalchemy import SQLAlchemy
import bcrypt

db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(
        db.String(20), nullable=False, default="user"
    )  # superadmin, admin, user
    api_key = db.Column(db.String(256), nullable=True)
    orders = db.relationship(
        "SIMOrder", backref="user", lazy=True, cascade="all, delete-orphan"
    )

    def __init__(self, username=None, role=None, **kwargs):
        super().__init__(**kwargs)
        if username is not None:
            self.username = username
        if role is not None:
            self.role = role

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def to_dict(self):
        active_count = sum(1 for o in self.orders if o.status == "active")
        completed_count = sum(1 for o in self.orders if o.status == "completed")
        cancelled_count = sum(1 for o in self.orders if o.status == "cancelled")
        expired_count = sum(1 for o in self.orders if o.status == "expired")
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "active_count": active_count,
            "completed_count": completed_count,
            "cancelled_count": cancelled_count,
            "expired_count": expired_count,
        }


class SIMOrder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    request_id = db.Column(db.String(50), unique=True, nullable=False)
    number = db.Column(db.String(20), nullable=False)
    status = db.Column(
        db.String(20), nullable=False
    )  # active, completed, cancelled, expired
    price = db.Column(db.String(20), nullable=False, default="4.50")
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    messages = db.relationship(
        "OTPMessage", backref="order", lazy=True, cascade="all, delete-orphan"
    )

    def __init__(
        self,
        user_id=None,
        request_id=None,
        number=None,
        status=None,
        price=None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        if user_id is not None:
            self.user_id = user_id
        if request_id is not None:
            self.request_id = request_id
        if number is not None:
            self.number = number
        if status is not None:
            self.status = status
        if price is not None:
            self.price = price

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "request_id": self.request_id,
            "number": self.number,
            "status": self.status,
            "price": self.price,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "messages": [m.to_dict() for m in self.messages],
        }


class OTPMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("sim_order.id"), nullable=False)
    otp = db.Column(db.String(20), nullable=True)
    text = db.Column(db.Text, nullable=False)
    received_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def __init__(self, order_id=None, otp=None, text=None, **kwargs):
        super().__init__(**kwargs)
        if order_id is not None:
            self.order_id = order_id
        if otp is not None:
            self.otp = otp
        if text is not None:
            self.text = text

    def to_dict(self):
        return {
            "id": self.id,
            "otp": self.otp,
            "text": self.text,
            "received_at": self.received_at.isoformat() if self.received_at else None,
        }
