import {WorkflowCommand} from '../../cli/command.js';
import {commonFlags, timeFlag} from '../../cli/flags.js';

export default class Current extends WorkflowCommand {
  static description = 'List all incomplete tasks on the selected day whose complete time blocks contain the reference moment. Start inclusive, end exclusive; overlaps return all tasks.';
  static examples = ['<%= config.bin %> tasks current', '<%= config.bin %> tasks current --date 2026-10-13 --time 10:15 --json'];
  static flags = {...commonFlags, time: timeFlag};
  async run(): Promise<void> {
    const {flags} = await this.parse(Current);
    await this.executeQuery('current', flags);
  }
}
