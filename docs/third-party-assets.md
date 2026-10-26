# Third-party assets

Last checked: October 26, 2026

- `assets/free-exercise-db/`: exercise text and image dataset. The repository includes `LICENSE.md` identifying the dataset as Unlicense/public domain. Verify the upstream source and license again if replacing or adding records.
- No custom typography fonts are bundled in the app's `assets/` directory. The web export includes icon font files from `@expo/vector-icons` for the app's interface icons; these are library assets, not custom brand fonts.
- The app displays a profile image URL returned by Google only when the user chooses Google sign-in. The app does not bundle or license that image as an app asset.
- No other shipped image assets with an unverified license were identified in the app code review.
