# Pinned operator release updates

Active Development, #758, Core #2015.

- PRU-1. Service detail for @tui and @cli offers an explicit release check through Core POST /api/services/:id/pinned-release/check. Show current and available exact release tags.
- PRU-2. Installation requires a dialog naming the selected candidate and confirmation. POST /api/services/:id/pinned-release/install sends only that checked tag and confirm true. Display pending completion and safe failures. The installed client version is used on its next launch.
- PRU-3. Requests use the existing local operator session adapter. An unavailable older Core produces a clear safe message and permits a later check. No browser release fetching or credential persistence.
- PRU-4. Service selection changes clear candidate and confirmation. Duplicate clicks cannot overlap installation. Existing moving update behavior remains governed by its own policy.
- PRU-5. Verify rendered check, cancel, confirm, pending/error, current-release and service-switch behavior with actual HTTP client calls.

Source delivery uses a develop PR and distinct review. Publication and deployed package qualification are separately authorized.
