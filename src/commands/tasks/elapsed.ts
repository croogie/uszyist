import {WorkflowCommand} from '../../cli/command.js';
import {commonFlags, timeFlag} from '../../cli/flags.js';

export default class Elapsed extends WorkflowCommand {
  static description = 'List incomplete tasks on the selected day whose complete time blocks end at or before the reference moment. This does not prove that no work occurred.';
  static examples = ['<%= config.bin %> tasks elapsed', '<%= config.bin %> tasks elapsed --time 20:00 --json'];
  static flags = {...commonFlags, time: timeFlag};
  async run(): Promise<void> {
    const {flags} = await this.parse(Elapsed);
    await this.executeQuery('elapsed', flags);
  }
}
