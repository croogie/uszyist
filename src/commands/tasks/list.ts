import {WorkflowCommand} from '../../cli/command.js';
import {commonFlags} from '../../cli/flags.js';

export default class List extends WorkflowCommand {
  static description = 'List incomplete tasks assigned to a day, including tasks without a start time.';
  static examples = ['<%= config.bin %> tasks list', '<%= config.bin %> tasks list --date 2026-10-13 --json'];
  static flags = {...commonFlags};
  async run(): Promise<void> {
    const {flags} = await this.parse(List);
    await this.executeQuery('list', flags);
  }
}
