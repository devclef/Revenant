# RFC 8785 test vectors

These files are copied unchanged from the reference implementation's test data:
https://github.com/cyberphone/json-canonicalization/tree/master/testdata
(commit 32a48195b9b20fe67b1795e39e4509f14d860b45).

- `input/<name>.json`: JSON to canonicalise.
- `output/<name>.json`: the expected RFC 8785 canonical form, byte for byte.

Names: arrays, structures, unicode, values, weird.

Copyright 2018 Anders Rundgren. Licensed under the Apache License, Version 2.0:
https://www.apache.org/licenses/LICENSE-2.0

Owner-committed. Agents read these files and must not edit or re-download them.
