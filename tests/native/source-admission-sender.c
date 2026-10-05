/* Fixture only: configure the genuine original sender; never hold/close it. */
#include <node_api.h>
#include <uv.h>
#include <stdint.h>
#if !defined(_WIN32) && !defined(__linux__)
#error Fixture_sender_requires_Windows_or_Linux
#endif
#ifdef _WIN32
#include <winsock2.h>
#else
#include <sys/socket.h>
#include <netinet/in.h>
#endif

typedef struct { unsigned local, remote, matches; uv_tcp_t* match; } selection;

static int endpoints(uv_tcp_t* tcp, unsigned local, unsigned remote) {
  struct sockaddr_storage a, b;
  int alen = (int)sizeof(a), blen = (int)sizeof(b);
  if (uv_tcp_getsockname(tcp, (struct sockaddr*)&a, &alen) ||
      uv_tcp_getpeername(tcp, (struct sockaddr*)&b, &blen) ||
      a.ss_family != AF_INET || b.ss_family != AF_INET) return 0;
  const struct sockaddr_in* left = (const struct sockaddr_in*)&a;
  const struct sockaddr_in* right = (const struct sockaddr_in*)&b;
  return ntohl(left->sin_addr.s_addr) == 0x7f000001 &&
         ntohl(right->sin_addr.s_addr) == 0x7f000001 &&
         ntohs(left->sin_port) == local && ntohs(right->sin_port) == remote;
}
static void select_handle(uv_handle_t* handle, void* data) {
  selection* value = data;
  if (handle->type == UV_TCP && !uv_is_closing(handle) &&
      endpoints((uv_tcp_t*)handle, value->local, value->remote)) {
    value->matches++;
    value->match = (uv_tcp_t*)handle;
  }
}
static napi_value failure(napi_env env) {
  napi_throw_error(env, "FIXTURE_SENDER_NATIVE", "FIXTURE_SENDER_NATIVE");
  return NULL;
}
static int port(napi_env env, napi_value value, unsigned* out) {
  double number;
  if (napi_get_value_double(env, value, &number) != napi_ok ||
      !(number >= 1 && number <= 65535)) return 0;
  *out = (unsigned)number;
  return (double)*out == number;
}
static int property(napi_env env, napi_value object, const char* name, int number) {
  napi_value value;
  return napi_create_int32(env, number, &value) == napi_ok &&
         napi_set_named_property(env, object, name, value) == napi_ok;
}
static napi_value configure(napi_env env, napi_callback_info info) {
  napi_value args[2], result;
  size_t argc = 2;
  selection selected = {0};
  uv_loop_t* loop;
  const napi_node_version* version;
  if (napi_get_node_version(env, &version) != napi_ok || version->major != 22 ||
      version->minor != 23 || version->patch != 2 ||
      napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok || argc != 2 ||
      !port(env, args[0], &selected.local) || !port(env, args[1], &selected.remote) ||
      napi_get_uv_event_loop(env, &loop) != napi_ok) return failure(env);
  /* Called synchronously on this owning JS/uv loop; no retained native pointer. */
  uv_walk(loop, select_handle, &selected);
  if (selected.matches != 1 || uv_is_closing((uv_handle_t*)selected.match) ||
      !endpoints(selected.match, selected.local, selected.remote)) return failure(env);
  uv_os_fd_t descriptor;
  if (uv_fileno((uv_handle_t*)selected.match, &descriptor)) return failure(env);
#ifdef _WIN32
  const SOCKET socket = (SOCKET)(uintptr_t)descriptor;
  int requested = 0, option_length = (int)sizeof(int);
  if (socket == INVALID_SOCKET) return failure(env);
#else
  const int socket = descriptor;
  int requested = 4096;
  socklen_t option_length = sizeof(int);
  if (socket < 0) return failure(env);
#endif
  int type, before, after;
  if (getsockopt(socket, SOL_SOCKET, SO_TYPE, (char*)&type, &option_length) ||
      (size_t)option_length != sizeof(int) || type != SOCK_STREAM) return failure(env);
  option_length = sizeof(int);
  if (getsockopt(socket, SOL_SOCKET, SO_SNDBUF, (char*)&before, &option_length) ||
      (size_t)option_length != sizeof(int) || before < 0 || before > 67108864 ||
      setsockopt(socket, SOL_SOCKET, SO_SNDBUF, (const char*)&requested, sizeof(requested))) return failure(env);
  option_length = sizeof(int);
  if (getsockopt(socket, SOL_SOCKET, SO_SNDBUF, (char*)&after, &option_length) ||
      (size_t)option_length != sizeof(int)) return failure(env);
#ifdef _WIN32
  if (after != 0) return failure(env);
#else
  if (after <= 0 || after > 16384) return failure(env);
#endif
  if (napi_create_object(env, &result) != napi_ok ||
      !property(env, result, "requested", requested) ||
      !property(env, result, "before", before) ||
      !property(env, result, "after", after)) return failure(env);
  return result;
}
static napi_value initialize(napi_env env, napi_value exports) {
  napi_value fn;
  if (napi_create_function(env, "configure", NAPI_AUTO_LENGTH, configure, NULL, &fn) != napi_ok ||
      napi_set_named_property(env, exports, "configure", fn) != napi_ok) return failure(env);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
