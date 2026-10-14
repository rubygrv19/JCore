import { handleTimeshitActivity } from '../../../utils/timeshit-activity-handler'

export default defineEventHandler(event => handleTimeshitActivity(event, 'resume'))
