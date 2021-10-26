public with sharing class TimetrackController {
	/*
	 * @description:
	 */
    @AuraEnabled
	public static TimetrackInfo getTimetrackInfo() {
		try {
			TimetrackInfo info = new TimetrackInfo();
			info.categories = selectCategories();
			info.entries = selectEntries();

			return info;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c saveTimetrackEntry(Id timetrackEntryId, String name, Id categoryId) {
		try {
			Timetrack_Entry__c entry = new Timetrack_Entry__c(
				Id = timetrackEntryId,
				Name = name,
				Category__c = categoryId
			);
			upsert entry;

			entry = selectTimetrackEntryById(entry.Id);

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c completeTimetrackEntry(Id timetrackEntryId) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			if(entry.Start_Date__c == null) entry.Start_Date__c = DateTime.now();
			if(entry.Duration__c == null) entry.Duration__c = 0;
			Long fifteenMinutes = 15 * 60 * 1000;
			Long difference = Math.mod((Long)entry.Duration__c,fifteenMinutes);
			if(difference != 0) {
				entry.Duration__c += fifteenMinutes - difference;
			}
			entry.Completed__c = true;
			entry.End_Date__c = DateTime.now();

			update entry;

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c uncompleteTimetrackEntry(Id timetrackEntryId) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			if(entry.Duration__c == 0) entry.Start_Date__c = null;
			entry.Completed__c = false;
			entry.End_Date__c = null;

			update entry;

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c startTimetrackEntry(Id timetrackEntryId, Long epoch) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			entry.Stopwatch_Start__c = epoch;
			if(entry.Start_Date__c == null) entry.Start_Date__c = DateTime.now();

			update entry;

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c resetTimetrackEntry(Id timetrackEntryId) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			entry.Stopwatch_Start__c = null;
			entry.Duration__c = 0;
			entry.Start_Date__c = null;
			entry.End_Date__c = null;

			update entry;

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c stopTimetrackEntry(Id timetrackEntryId, Long epoch) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			if(entry.Stopwatch_Start__c == null) entry.Stopwatch_Start__c = 0;
			if(entry.Duration__c == null) entry.Duration__c = 0;
			Long totalTime = epoch - (Long)entry.Stopwatch_Start__c;

			entry.Duration__c += totalTime;
			entry.Stopwatch_Start__c = null;

			update entry;

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c setTimetrackDescription(Id timetrackEntryId, String description) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			entry.Description__c = description;

			update entry;

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c associateTimetrackWithRecord(Id timetrackEntryId, Id recordId) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			entry.Record_Id__c = recordId;
			if(recordId != null) {
				if(recordId.getSobjectType() == Case.getSObjectType()) {
					entry.Case__c = recordId;
					entry.Account__c = null;
				}
				else if(recordId.getSobjectType() == Account.getSObjectType()) {
					entry.Account__c = recordId;
					entry.Case__c = null;
				}
			}
			else {
				entry.Case__c = null;
				entry.Account__c = null;
			}

			update entry;

			entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry.Case__c != null && entry.Case__r.AccountId != null && entry.Account__c == null) {
				entry.Account__c = entry.Case__r.AccountId;
				update entry;
				entry = selectTimetrackEntryById(timetrackEntryId);
			}

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static void deleteTimetrackEntry(Id timetrackEntryId) {
		try {
			Timetrack_Entry__c entry = new Timetrack_Entry__c(
				Id = timetrackEntryId
			);
			delete entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
    @AuraEnabled
	public static Timetrack_Entry__c addMillisecondsToTimetrackEntry(Id timetrackEntryId, Long ms) {
		try {
			Timetrack_Entry__c entry = selectTimetrackEntryById(timetrackEntryId);
			if(entry == null) return null;

			if(entry.Duration__c == null) entry.Duration__c = 0;
			entry.Duration__c += ms;

			update entry;

			return entry;
		} catch (Exception e) {
			System.debug(e.getMessage() + '\r\n' + e.getStackTraceString());
			throw new AuraHandledException(e.getMessage());
		}
	}

	/*
	 * @description:
	 */
	public class TimetrackInfo {
		@AuraEnabled
		public List<Timetrack_Category__c> categories {get; set;}

		@AuraEnabled
		public List<Timetrack_Entry__c> entries {get; set;}
	}

	// SELECTORS

	/*
	 * @description:
	 */
	private static List<Timetrack_Category__c> selectCategories() {
		return [
			select
				Id,
				Name,
				Description__c
			from
				Timetrack_Category__c
			where
				Disabled__c = false
		];
	}

	/*
	 * @description:
	 */
	private static List<Timetrack_Entry__c> selectEntries() {
		return [
			select
				Id,
				Name,
				Category__c,
				Category__r.Name,
				Duration__c,
				Completed__c,
				Start_Date__c,
				End_Date__c,
				Stopwatch_Start__c,
				Description__c,
				Record_Id__c,
				Case__c,
				Case__r.CaseNumber,
				Case__r.AccountId,
				Account__c,
				Account__r.Name
			from
				Timetrack_Entry__c
			where
				OwnerId = :UserInfo.getUserId() and
				(Completed__c = false or End_Date__c = TODAY or End_Date__c = THIS_WEEK)
		];
	}

	/*
	 * @description:
	 */
	private static Timetrack_Entry__c selectTimetrackEntryById(Id entryId) {
		List<Timetrack_Entry__c> entries = [
			select
				Id,
				Name,
				Category__c,
				Category__r.Name,
				Duration__c,
				Completed__c,
				Start_Date__c,
				End_Date__c,
				Stopwatch_Start__c,
				Description__c,
				Record_Id__c,
				Case__c,
				Case__r.CaseNumber,
				Case__r.AccountId,
				Account__c,
				Account__r.Name
			from
				Timetrack_Entry__c
			where
				Id = :entryId
		];

		return !entries.isEmpty() ? entries[0] : null;
	}
}