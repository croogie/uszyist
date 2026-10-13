import {WorkflowCommand} from '../../cli/command.js'
import {commonFlags} from '../../cli/flags.js'

export default class Timeline extends WorkflowCommand {
  static description = 'List all tasks assigned to a day, both open and completed, ordered by planned start. Tasks without a start appear last. Completion history is selected by assigned date, not completion date; recurring completions can share a task ID. Defaults to today. No time parameter.'
  static examples = ['<%= config.bin %> tasks timeline', '<%= config.bin %> tasks timeline --date 2026-10-13 --json']
  static flags = {...commonFlags}
  async run(): Promise<void> {
    const {flags} = await this.parse(Timeline)
    await this.executeQuery('timeline', flags)
  }
}
