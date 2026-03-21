import { describe, it, expect } from 'vitest';
import { validatePythonCode } from '../../src/lib/security/python-sandbox';

describe('Python Sandbox Validation', () => {
  describe('validatePythonCode', () => {
    it('accepts valid transform code', () => {
      const code = `
import math

def transform(data):
    return [{'value': math.sqrt(row['value'])} for row in data]
`;
      expect(validatePythonCode(code).valid).toBe(true);
    });

    it('requires transform function', () => {
      const code = `result = [1, 2, 3]`;
      const result = validatePythonCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('transform(data)');
    });

    it('blocks os import', () => {
      const code = `
import os
def transform(data):
    os.system('rm -rf /')
    return data
`;
      const result = validatePythonCode(code);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('import os');
    });

    it('blocks subprocess import', () => {
      const code = `
import subprocess
def transform(data):
    subprocess.call(['ls'])
    return data
`;
      expect(validatePythonCode(code).valid).toBe(false);
    });

    it('blocks socket import', () => {
      const code = `
import socket
def transform(data):
    return data
`;
      expect(validatePythonCode(code).valid).toBe(false);
    });

    it('blocks eval/exec', () => {
      expect(validatePythonCode(`def transform(data): return eval('data')`).valid).toBe(false);
      expect(validatePythonCode(`def transform(data): exec('pass'); return data`).valid).toBe(false);
    });

    it('blocks file operations', () => {
      expect(validatePythonCode(`def transform(data): open('/etc/passwd'); return data`).valid).toBe(false);
    });

    it('blocks __builtins__ access', () => {
      expect(validatePythonCode(`def transform(data): return __builtins__`).valid).toBe(false);
    });

    it('blocks __import__', () => {
      expect(validatePythonCode(`def transform(data): __import__('os'); return data`).valid).toBe(false);
    });

    it('blocks __subclasses__', () => {
      expect(validatePythonCode(`def transform(data): return ''.__class__.__subclasses__()`).valid).toBe(false);
    });

    it('allows safe math imports', () => {
      expect(validatePythonCode(`import math\ndef transform(data): return data`).valid).toBe(true);
    });

    it('allows safe statistics imports', () => {
      expect(validatePythonCode(`import statistics\ndef transform(data): return data`).valid).toBe(true);
    });

    it('allows safe datetime imports', () => {
      expect(validatePythonCode(`import datetime\ndef transform(data): return data`).valid).toBe(true);
    });

    it('allows safe json imports', () => {
      expect(validatePythonCode(`import json\ndef transform(data): return data`).valid).toBe(true);
    });

    it('allows safe re imports', () => {
      expect(validatePythonCode(`import re\ndef transform(data): return data`).valid).toBe(true);
    });

    it('allows safe collections imports', () => {
      expect(validatePythonCode(`import collections\ndef transform(data): return data`).valid).toBe(true);
    });

    it('blocks requests library', () => {
      expect(validatePythonCode(`import requests\ndef transform(data): return data`).valid).toBe(false);
    });

    it('blocks http library', () => {
      const code = `
import http
def transform(data):
    return data
`;
      expect(validatePythonCode(code).valid).toBe(false);
    });

    it('blocks urllib', () => {
      const code = `
import urllib
def transform(data):
    return data
`;
      expect(validatePythonCode(code).valid).toBe(false);
    });

    it('blocks importlib', () => {
      expect(validatePythonCode(`def transform(data): importlib.import_module('os'); return data`).valid).toBe(false);
    });

    it('blocks ctypes', () => {
      expect(validatePythonCode(`def transform(data): ctypes.cdll; return data`).valid).toBe(false);
    });

    it('blocks shutil', () => {
      const code = `import shutil\ndef transform(data): return data`;
      expect(validatePythonCode(code).valid).toBe(false);
    });

    it('blocks globals/locals/vars access', () => {
      expect(validatePythonCode(`def transform(data): globals(); return data`).valid).toBe(false);
      expect(validatePythonCode(`def transform(data): locals(); return data`).valid).toBe(false);
      expect(validatePythonCode(`def transform(data): vars(); return data`).valid).toBe(false);
    });

    it('blocks getattr/setattr/delattr', () => {
      expect(validatePythonCode(`def transform(data): getattr(data, 'x'); return data`).valid).toBe(false);
      expect(validatePythonCode(`def transform(data): setattr(data, 'x', 1); return data`).valid).toBe(false);
      expect(validatePythonCode(`def transform(data): delattr(data, 'x'); return data`).valid).toBe(false);
    });
  });
});
