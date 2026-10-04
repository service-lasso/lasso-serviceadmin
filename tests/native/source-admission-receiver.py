"""Original native TCP client fixture only; never product/template authority."""
import time
_STARTED = time.monotonic()
import json
import os
import socket
import sys

_LIMIT = 3.0
_REQUEST = (b"PUT /api/service-source-admission/stages/sas_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/content HTTP/1.1\r\n"
            b"Host: 127.0.0.1\r\nConnection: close\r\nContent-Length: 1\r\n"
            b"Content-Type: application/vnd.service-lasso.template-project+zip\r\n\r\nx")

class FixtureFailure(Exception):
    pass

def remaining():
    value = _LIMIT - (time.monotonic() - _STARTED)
    if value <= 0:
        raise FixtureFailure("deadline")
    return value

def emit(record):
    data = (json.dumps(record, separators=(",", ":")) + "\n").encode("ascii")
    if len(data) > 512:
        raise FixtureFailure("output")
    offset = 0
    while offset < len(data):
        remaining()
        try:
            count = os.write(1, data[offset:])
        except BlockingIOError:
            time.sleep(min(0.001, remaining()))
            continue
        if count <= 0:
            raise FixtureFailure("output")
        offset += count

def main():
    original = None
    failure = None
    code = "platform"
    try:
        if sys.platform not in ("win32", "linux") or sys.version_info[:2] != (3, 14):
            raise FixtureFailure(code)
        code = "arguments"
        if len(sys.argv) != 2 or not sys.argv[1].isascii() or not sys.argv[1].isdigit():
            raise FixtureFailure(code)
        port = int(sys.argv[1])
        if not 1 <= port <= 65535:
            raise FixtureFailure(code)
        code = "control"
        os.set_blocking(0, False)
        os.set_blocking(1, False)
        code = "socket_option"
        original = socket.socket(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
        original.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4096)
        before = original.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
        if not 0 < before <= 65536:
            raise FixtureFailure(code)
        code = "connect"
        original.settimeout(remaining())
        original.connect(("127.0.0.1", port))
        after = original.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
        if not 0 < after <= 65536:
            raise FixtureFailure("socket_option")
        code = "send"
        original.settimeout(remaining())
        original.sendall(_REQUEST)
        code = "header"
        headers = bytearray()
        while not headers.endswith(b"\r\n\r\n"):
            if len(headers) >= 8192:
                raise FixtureFailure(code)
            original.settimeout(remaining())
            byte = original.recv(1)
            if len(byte) != 1:
                raise FixtureFailure(code)
            headers.extend(byte)
        if not headers.startswith(b"HTTP/1.1 200 "):
            raise FixtureFailure(code)
        emit({"schema": "sa-recv-window.v1", "phase": "ready", "requested": 4096,
              "before": before, "after": after, "status": 200, "headerBytes": len(headers),
              "bodyBytes": 0, "requestBytes": len(_REQUEST)})
        # No socket recv after headers: only own bounded control pipe is polled.
        code = "control"
        command = bytearray()
        while len(command) < 6:
            remaining()
            try:
                part = os.read(0, 6 - len(command))
            except BlockingIOError:
                time.sleep(min(0.001, remaining()))
                continue
            if not part:
                raise FixtureFailure(code)
            command.extend(part)
        if command != b"close\n":
            raise FixtureFailure(code)
        # A command is complete only at genuine original control-pipe EOF.
        while True:
            remaining()
            try:
                extra = os.read(0, 1)
            except BlockingIOError:
                time.sleep(min(0.001, remaining()))
                continue
            if extra:
                raise FixtureFailure(code)
            break
    except FixtureFailure as error:
        failure = str(error)
    except TimeoutError:
        failure = "deadline"
    except (OSError, ValueError, OverflowError):
        failure = code
    finally:
        if original is not None:
            try:
                original.close()
            except OSError:
                failure = "close"
    try:
        if failure is not None:
            emit({"schema": "sa-recv-window.v1", "phase": "failed", "code": failure})
            return 1
        emit({"schema": "sa-recv-window.v1", "phase": "closed", "socketClose": True})
        return 0
    except (FixtureFailure, OSError, ValueError):
        return 1

if __name__ == "__main__":
    sys.exit(main())