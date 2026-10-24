import ctypes as C
import hashlib
from pathlib import Path


class Node(C.Structure):
    pass


class NodeList(C.Structure):
    pass


class NodeValue(C.Union):
    _fields_ = [
        ('string', C.c_char_p), ('flag', C.c_int), ('integer', C.c_int64),
        ('number', C.c_double), ('list', C.POINTER(NodeList)), ('pointer', C.c_void_p),
    ]


Node._fields_ = [('value', NodeValue), ('format', C.c_int)]
NodeList._fields_ = [('count', C.c_int), ('values', C.POINTER(Node)), ('keys', C.POINTER(C.c_char_p))]


class Event(C.Structure):
    _fields_ = [('kind', C.c_int), ('error', C.c_int), ('reply', C.c_uint64), ('data', C.c_void_p)]


class Hook(C.Structure):
    _fields_ = [('name', C.c_char_p), ('id', C.c_uint64)]


class FileEnd(C.Structure):
    _fields_ = [('reason', C.c_int), ('error', C.c_int)]


def decode(node):
    if node.format == 0:
        return None
    if node.format == 1:
        return node.value.string.decode('utf-8')
    if node.format == 3:
        return bool(node.value.flag)
    if node.format == 4:
        return node.value.integer
    if node.format == 5:
        return node.value.number
    if node.format == 7:
        items = node.value.list.contents
        return [decode(items.values[index]) for index in range(items.count)]
    if node.format == 8:
        items = node.value.list.contents
        return {items.keys[index].decode('utf-8'): decode(items.values[index]) for index in range(items.count)}
    raise ValueError(f'Unexpected node format: {node.format}')


class Runtime:
    """Load the recorded library once and retain it for the process lifetime."""

    def __init__(self, path: Path, digest: str):
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('The recorded libmpv library digest does not match')

        self.library = C.CDLL(str(path), winmode=0x1100)
        signatures = {
            'mpv_create': (C.c_void_p, []),
            'mpv_initialize': (C.c_int, [C.c_void_p]),
            'mpv_set_option_string': (C.c_int, [C.c_void_p, C.c_char_p, C.c_char_p]),
            'mpv_get_property': (C.c_int, [C.c_void_p, C.c_char_p, C.c_int, C.c_void_p]),
            'mpv_command': (C.c_int, [C.c_void_p, C.POINTER(C.c_char_p)]),
            'mpv_wait_event': (C.POINTER(Event), [C.c_void_p, C.c_double]),
            'mpv_free_node_contents': (None, [C.POINTER(Node)]),
            'mpv_hook_add': (C.c_int, [C.c_void_p, C.c_uint64, C.c_char_p, C.c_int]),
            'mpv_hook_continue': (C.c_int, [C.c_void_p, C.c_uint64]),
            'mpv_terminate_destroy': (None, [C.c_void_p]),
        }
        for name, (result, arguments) in signatures.items():
            function = getattr(self.library, name)
            function.restype = result
            function.argtypes = arguments

    def create(self, *, decode_video: bool, paused: bool = True):
        return Core(self, decode_video=decode_video, paused=paused)


class Core:
    """Own one paused core; every caller closes it after reading or cancellation."""

    def __init__(self, runtime: Runtime, *, decode_video: bool, paused: bool):
        self.library = runtime.library
        self.handle = self.library.mpv_create()
        if not self.handle:
            raise RuntimeError('mpv_create failed')

        options = {
            'config': 'no', 'terminal': 'no', 'load-scripts': 'no',
            'idle': 'yes', 'pause': 'yes' if paused else 'no', 'keep-open': 'yes',
            'ao': 'null', 'vo': 'null', 'cache': 'no',
            'sub-auto': 'no', 'audio-file-auto': 'no', 'sid': 'no',
        }
        if not decode_video:
            options.update({'vid': 'no', 'aid': 'no'})

        try:
            for name, value in options.items():
                self.check(self.library.mpv_set_option_string(self.handle, name.encode(), value.encode()), name)
            self.check(self.library.mpv_initialize(self.handle), 'initialize')
        except BaseException:
            self.close()
            raise

    @staticmethod
    def check(status: int, operation: str):
        if status < 0:
            raise RuntimeError(f'{operation} failed with libmpv code {status}')

    def command(self, *arguments: str):
        """Wait for command acceptance; file readiness is observed separately."""
        native_arguments = (C.c_char_p * (len(arguments) + 1))(
            *[argument.encode('utf-8') for argument in arguments], None,
        )
        self.check(self.library.mpv_command(self.handle, native_arguments), arguments[0])

    def get(self, name: str):
        """Copy a native property and release its C-owned storage before returning."""
        node = Node()
        status = self.library.mpv_get_property(self.handle, name.encode(), 6, C.byref(node))
        if status < 0:
            return {'unavailable': status}

        try:
            return decode(node)
        finally:
            self.library.mpv_free_node_contents(C.byref(node))

    def event(self, timeout_seconds: float = 0.05):
        """Copy the event fields that remain valid only until the next event read."""
        event = self.library.mpv_wait_event(self.handle, timeout_seconds).contents
        result = {'kind': event.kind, 'error': event.error}
        if event.kind == 7 and event.data:
            end = C.cast(event.data, C.POINTER(FileEnd)).contents
            result.update({'reason': end.reason, 'fileError': end.error})
        if event.kind == 25 and event.data:
            hook = C.cast(event.data, C.POINTER(Hook)).contents
            result.update({'hook': hook.name.decode('utf-8'), 'hookId': hook.id})
        return result

    def add_preloaded_hook(self):
        self.check(self.library.mpv_hook_add(self.handle, 100, b'on_preloaded', 50), 'add hook')

    def continue_hook(self, identifier: int):
        self.check(self.library.mpv_hook_continue(self.handle, identifier), 'continue hook')

    def close(self):
        """Wait for core destruction and release this handle exactly once."""
        if self.handle:
            self.library.mpv_terminate_destroy(self.handle)
            self.handle = None
