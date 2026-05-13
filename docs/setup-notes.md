# Setup Notes

## Day columns

The dashboard has:

- Process Days: current stage duration.
- LOS Days: overall duration from application to current/completed date.

For accurate Process Days, add one of these columns to your Google Sheet:

- CURRENT_STEP_START_DATE
- PROCESS_START_DATE
- STATUS_START_DATE

If none exists, Process Days falls back to LOS Days.
