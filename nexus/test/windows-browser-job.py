"""Own a Windows Chrome process tree until the regression runner closes stdin."""

import _winapi
import ctypes as C
from ctypes import wintypes as W
import os
import subprocess
import sys
import threading
import time

CREATE_SUSPENDED = 0x00000004
KILL_ON_JOB_CLOSE = 0x00002000
JOB_ACCOUNTING = 1
JOB_EXTENDED_LIMITS = 9


class BasicLimits(C.Structure):
    _fields_ = [
        ("process_time", C.c_longlong), ("job_time", C.c_longlong),
        ("flags", W.DWORD), ("min_working_set", C.c_size_t),
        ("max_working_set", C.c_size_t), ("active_limit", W.DWORD),
        ("affinity", C.c_size_t), ("priority", W.DWORD), ("scheduling", W.DWORD),
    ]


class ExtendedLimits(C.Structure):
    _fields_ = [
        ("basic", BasicLimits), ("io_counters", C.c_ulonglong * 6),
        ("process_memory", C.c_size_t), ("job_memory", C.c_size_t),
        ("peak_process_memory", C.c_size_t), ("peak_job_memory", C.c_size_t),
    ]


class Accounting(C.Structure):
    _fields_ = [
        ("times", C.c_longlong * 4), ("page_faults", W.DWORD),
        ("total", W.DWORD), ("active", W.DWORD), ("terminated", W.DWORD),
    ]


kernel = C.WinDLL("kernel32", use_last_error=True)


def binding(name, result, *args):
    function = getattr(kernel, name)
    function.argtypes, function.restype = args, result
    return function


create_job = binding("CreateJobObjectW", W.HANDLE, C.c_void_p, W.LPCWSTR)
set_job = binding("SetInformationJobObject", W.BOOL, W.HANDLE, C.c_int, C.c_void_p, W.DWORD)
assign = binding("AssignProcessToJobObject", W.BOOL, W.HANDLE, W.HANDLE)
resume = binding("ResumeThread", W.DWORD, W.HANDLE)
query = binding("QueryInformationJobObject", W.BOOL, W.HANDLE, C.c_int, C.c_void_p, W.DWORD, C.c_void_p)
terminate_job = binding("TerminateJobObject", W.BOOL, W.HANDLE, W.UINT)


def checked(result):
    if not result:
        raise C.WinError(C.get_last_error())
    return result


def active_processes(job):
    accounting = Accounting()
    checked(query(job, JOB_ACCOUNTING, C.byref(accounting), C.sizeof(accounting), None))
    return accounting.active


def wait_until_idle(job, seconds):
    deadline = time.monotonic() + seconds
    while active_processes(job):
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)
    return True


def main():
    browser = sys.argv[1:]
    job = checked(create_job(None, None))
    try:
        limits = ExtendedLimits()
        limits.basic.flags = KILL_ON_JOB_CLOSE
        checked(set_job(job, JOB_EXTENDED_LIMITS, C.byref(limits), C.sizeof(limits)))
        # Assign while suspended so Chrome's first child also belongs to this job.
        process, thread, _, _ = _winapi.CreateProcess(
            browser[0], subprocess.list2cmdline(browser), None, None, False,
            CREATE_SUSPENDED | subprocess.CREATE_NO_WINDOW, None, None, subprocess.STARTUPINFO(),
        )
        try:
            if not assign(job, process):
                error = C.WinError(C.get_last_error())
                _winapi.TerminateProcess(process, 1)
                raise error
            if resume(thread) != 1:
                raise RuntimeError("Could not resume the owned browser")
        finally:
            _winapi.CloseHandle(thread)
            _winapi.CloseHandle(process)

        closed = threading.Event()

        def wait_for_runner():
            try:
                os.read(sys.stdin.fileno(), 1)
            finally:
                closed.set()

        threading.Thread(target=wait_for_runner, daemon=True).start()
        while active_processes(job) and not closed.wait(0.05):
            pass
        if not wait_until_idle(job, 2.5):
            checked(terminate_job(job, 1))
            if not wait_until_idle(job, 5):
                raise RuntimeError("Browser processes still active in the owned job")
    finally:
        _winapi.CloseHandle(job)


if __name__ == "__main__":
    main()
