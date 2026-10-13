import {Flags} from '@oclif/core';

export const commonFlags = {
  date: Flags.string({description: 'Calendar day (YYYY-MM-DD). Defaults to today in the system timezone.'}),
  json: Flags.boolean({description: 'Output stable JSON instead of a human-readable table.'}),
  help: Flags.help({char: 'h'}),
};
export const timeFlag = Flags.string({description: 'Reference clock time (HH:mm[:ss]). Defaults to the current local time, even for another date.'});
