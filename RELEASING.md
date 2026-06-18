## Pushing a release

Update `CHANGELOG.md` and `version.txt` before proceeding.

```sh
gh release create "$(cat version.txt)" build/* \
    --title "$(cat version.txt)" \
    --notes-file CHANGELOG.md
```

Pre-release versions are tagged automatically from `version.txt`. A version
of the form `1.0.0-beta.N` is published as a pre-release on GitHub.
