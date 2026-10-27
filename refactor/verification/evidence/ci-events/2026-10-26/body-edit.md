This temporary draft checks CI event routing against real GitHub pull-request events. The CI entry and PR-title workflows are exact copies of the proposed implementation; the verification payload is a bounded, deliberately failing stand-in so metadata edits can be tested while code verification is running and after it fails.

The exercise covers title/body edits, a target-branch change and a new source commit. It will be closed without merging and does not replace product or platform verification.

This paragraph is a body-only edit after the intentional code failure. The invalid title is deliberately retained for this observation.