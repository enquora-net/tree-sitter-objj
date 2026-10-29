## Pushing a release

Update `CHANGELOG.md` and `VERSION.txt` before proceeding.

```sh
gh release create "$(cat VERSION.txt)" build/* \
    --title "$(cat VERSION.txt)" \
    --notes-file CHANGELOG.md
```

Pre-release versions are tagged automatically from `VERSION.txt`. A version
of the form `2.0.0-beta.N` is published as a pre-release on GitHub.
