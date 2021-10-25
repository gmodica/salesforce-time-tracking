@isTest
private without sharing class TimetrackControllerTest {
	@testSetup
	private static void setup() {
		Timetrack_Category__c c1 = new Timetrack_Category__c(Name = 'Category 1');
		Timetrack_Category__c c2 = new Timetrack_Category__c(Name = 'Category 2');
		insert new Timetrack_Category__c[] { c1, c2 };
	}

	@isTest
	private static void testCategories() {
		Test.startTest();

		TimetrackController.TimetrackInfo info = TimetrackController.getTimetrackInfo();

		Test.stopTest();

		System.assertEquals(2, info.categories.size());
	}

	@isTest
	private static void testNewTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;

		Test.startTest();

		Timetrack_Entry__c entry = TimetrackController.saveTimetrackEntry(null, 'Test 1', categoryId);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertNotEquals(null, entry.Id);
		System.assertEquals('Test 1', entry.Name);
		System.assertEquals(categoryId, entry.Category__c);

		List<Timetrack_Entry__c> entries = [select Id,Name,Category__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals('Test 1', entries[0].Name);
		System.assertEquals(categoryId, entries[0].Category__c);
	}

	@isTest
	private static void testUpdateTimetrackEntry() {
		Id category1Id = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Id category2Id = [select Id from Timetrack_Category__c where Name = 'Category 2'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = category1Id);
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.saveTimetrackEntry(entry.Id, 'Test 2', category2Id);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals('Test 2', updatedEntry.Name);
		System.assertEquals(category2Id, updatedEntry.Category__c);

		List<Timetrack_Entry__c> entries = [select Id,Name,Category__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals('Test 2', entries[0].Name);
		System.assertEquals(category2Id, entries[0].Category__c);
	}

	@isTest
	private static void testCompleteTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId);
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.completeTimetrackEntry(entry.Id);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(true, updatedEntry.Completed__c);
		System.assertNotEquals(null, updatedEntry.End_Date__c);
		System.assertEquals(0, updatedEntry.Duration__c);

		List<Timetrack_Entry__c> entries = [select Id,Completed__c,End_Date__c,Duration__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(true, entries[0].Completed__C);
		System.assertNotEquals(null, entries[0].End_Date__c);
		System.assertEquals(0, entries[0].Duration__c);
	}

	@isTest
	private static void testCompleteTimetrackEntryWithFifteenMinutes() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId, Duration__c = 60000);
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.completeTimetrackEntry(entry.Id);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(true, updatedEntry.Completed__c);
		System.assertNotEquals(null, updatedEntry.End_Date__c);
		System.assertEquals(900000, updatedEntry.Duration__c);

		List<Timetrack_Entry__c> entries = [select Id,Completed__c,End_Date__c,Duration__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(true, entries[0].Completed__C);
		System.assertNotEquals(null, entries[0].End_Date__c);
		System.assertEquals(900000, entries[0].Duration__c); // 15 minutes
	}

	@isTest
	private static void testUncompleteTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId, Completed__c = true, Duration__c = 0, Start_Date__c = DateTime.now(), End_Date__c = DateTime.now());
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.uncompleteTimetrackEntry(entry.Id);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(false, updatedEntry.Completed__c);
		System.assertEquals(null, updatedEntry.Start_Date__c);
		System.assertEquals(null, updatedEntry.End_Date__c);
		System.assertEquals(0, updatedEntry.Duration__c);

		List<Timetrack_Entry__c> entries = [select Id,Completed__c,Start_Date__c,End_Date__c,Duration__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(false, entries[0].Completed__C);
		System.assertEquals(null, entries[0].Start_Date__c);
		System.assertEquals(null, entries[0].End_Date__c);
		System.assertEquals(0, entries[0].Duration__c);
	}

	@isTest
	private static void testUncompleteTimetrackEntryWithDuration() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId, Completed__c = true, Duration__c = 60000, Start_Date__c = DateTime.now(), End_Date__c = DateTime.now());
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.uncompleteTimetrackEntry(entry.Id);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(false, updatedEntry.Completed__c);
		System.assertNotEquals(null, updatedEntry.Start_Date__c);
		System.assertEquals(null, updatedEntry.End_Date__c);
		System.assertEquals(60000, updatedEntry.Duration__c);

		List<Timetrack_Entry__c> entries = [select Id,Completed__c,Start_Date__c,End_Date__c,Duration__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(false, entries[0].Completed__C);
		System.assertNotEquals(null, entries[0].Start_Date__c); // this doesn't change because duration is not 0
		System.assertEquals(null, entries[0].End_Date__c);
		System.assertEquals(60000, entries[0].Duration__c);
	}

	@isTest
	private static void testStartTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId);
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.startTimetrackEntry(entry.Id, 1000);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(1000, updatedEntry.Stopwatch_Start__c);
		System.assertNotEquals(null, updatedEntry.Start_Date__c);

		List<Timetrack_Entry__c> entries = [select Id,Stopwatch_Start__c,Start_Date__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(1000, entries[0].Stopwatch_Start__c);
		System.assertNotEquals(null, entries[0].Start_Date__c);
	}

	@isTest
	private static void testResetTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId, Completed__c = true, Duration__c = 1000, Start_Date__c = DateTime.now(), End_Date__c = DateTime.now(), Stopwatch_Start__c = 0);
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.resetTimetrackEntry(entry.Id);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(null, updatedEntry.Start_Date__c);
		System.assertEquals(null, updatedEntry.End_Date__c);
		System.assertEquals(0, updatedEntry.Duration__c);
		System.assertEquals(null, updatedEntry.Stopwatch_Start__c);

		List<Timetrack_Entry__c> entries = [select Id,Completed__c,Start_Date__c,End_Date__c,Duration__c,Stopwatch_Start__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(null, entries[0].Start_Date__c);
		System.assertEquals(null, entries[0].End_Date__c);
		System.assertEquals(0, entries[0].Duration__c);
		System.assertEquals(null, entries[0].Stopwatch_Start__c);
	}

	@isTest
	private static void testStopTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId, Duration__c = 1000, Stopwatch_Start__c = 2000);
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.stopTimetrackEntry(entry.Id, 3000);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(null, updatedEntry.Stopwatch_Start__c);
		System.assertEquals(2000, updatedEntry.Duration__c);

		List<Timetrack_Entry__c> entries = [select Id,Stopwatch_Start__c,Duration__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(null, entries[0].Stopwatch_Start__c);
		System.assertEquals(2000, entries[0].Duration__c);
	}

	@isTest
	private static void testDeleteTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId, Duration__c = 1000, Stopwatch_Start__c = 2000);
		insert entry;

		Test.startTest();

		TimetrackController.deleteTimetrackEntry(entry.Id);

		Test.stopTest();

		List<Timetrack_Entry__c> entries = [select Id,Stopwatch_Start__c,Duration__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(0, entries.size());
	}

	@isTest
	private static void testAddMillisecondsToTimetrackEntry() {
		Id categoryId = [select Id from Timetrack_Category__c where Name = 'Category 1'][0].Id;
		Timetrack_Entry__c entry = new Timetrack_Entry__c(Name = 'Test 1', Category__c = categoryId, Duration__c = 1000);
		insert entry;

		Test.startTest();

		Timetrack_Entry__c updatedEntry = TimetrackController.addMillisecondsToTimetrackEntry(entry.Id, 3000);

		Test.stopTest();

		System.assertNotEquals(null, entry);
		System.assertEquals(entry.Id, updatedEntry.Id);
		System.assertEquals(4000, updatedEntry.Duration__c);

		List<Timetrack_Entry__c> entries = [select Id,Duration__c from Timetrack_Entry__c where Id = :entry.Id];
		System.assertEquals(1, entries.size());

		System.assertEquals(4000, entries[0].Duration__c);
	}
}
