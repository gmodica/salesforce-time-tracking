import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadStyle } from 'lightning/platformResourceLoader';
import { NavigationMixin } from 'lightning/navigation';
import getTimetrackInfo from '@salesforce/apex/TimetrackController.getTimetrackInfo';
import saveTimetrackEntry from '@salesforce/apex/TimetrackController.saveTimetrackEntry';
import completeTimetrackEntry from '@salesforce/apex/TimetrackController.completeTimetrackEntry';
import uncompleteTimetrackEntry from '@salesforce/apex/TimetrackController.uncompleteTimetrackEntry';
import deleteTimetrackEntry from '@salesforce/apex/TimetrackController.deleteTimetrackEntry';
import addMillisecondsToTimetrackEntry from '@salesforce/apex/TimetrackController.addMillisecondsToTimetrackEntry';
import startTimetrackEntry from '@salesforce/apex/TimetrackController.startTimetrackEntry';
import stopTimetrackEntry from '@salesforce/apex/TimetrackController.stopTimetrackEntry';
import resetTimetrackEntry from '@salesforce/apex/TimetrackController.resetTimetrackEntry';
import setTimetrackDescription from '@salesforce/apex/TimetrackController.setTimetrackDescription';
import associateTimetrackWithRecord from '@salesforce/apex/TimetrackController.associateTimetrackWithRecord';
import fontawesome from '@salesforce/resourceUrl/fontawesome';
import { reduceErrors } from 'c/ldsUtils';

export default class Timetracking extends NavigationMixin(LightningElement) {
	label = {
		cardTitle: "Time Tracking Entries",
		actions: "Actions",
		refresh: "Refresh",
		refreshDescription: "Refresh",
		add: "Add",
		addDescription: "Add a new time track entry",
		edit: "Edit",
		editDescription: "Edit this entry",
		delete: "Delete",
		deleteDescription: "Delete this entry",
		save: "Save",
		saveDescription: "Save this entry",
		cancel: "Cancel",
		cancelDescription: "Cancel operation",
		confirmDelete: "Confirm delete",
		confirmDeleteDescription: "Confirm the delete operation",
		cancelDelete: "Cancel delete",
		cancelDeleteDescription: "Cancel the delete operation",
		complete: "Complete",
		completeDescription: "Mark entry as completed",
		uncomplete: "Uncomplete",
		uncompleteDescription: "Mark entry as uncompleted",
		start: "Start",
		startDescription: "Start timer for the entry",
		stop: "Stop",
		stopDescription: "Stop timer for the entry",
		reset: "Reset",
		resetDescription: "Reset entry to 0",
		note: "Edit Note",
		noteDescription: "Add/Edit note for entry",
		link: "Link",
		linkDescription: "Link entry with current record",
		unlink: "Unlink",
		unlinkDescription: "Unlink entry",
		close: "Close",
		sureToDelete: "Confirm?",
		name: "Task Name",
		namePlaceholder: "Enter the name of the task",
		category: "Category",
		loading: "Loading...",
		noDataTitle: "No entries found",
		noDataSubtitle: "This looks alone. Try creating a new entry by clicking on the + icon on the top right",
		errorTitle: "No data found",
		errorSubtitle: "No data could be retrieved",
		error: "Error",
		completed: "Completed",
		saveAllFirst: "You have some pending items to save. Please save all work before refreshing",
		add5Minutes: "Add 5 minutes to the timer",
		add15Minutes: "Add 15 minutes to the timer",
		add30Minutes: "Add 30 minutes to the timer",
		add45Minutes: "Add 45 minutes to the timer",
		add60Minutes: "Add 60 minutes to the timer",
		subtract5Minutes: "Subtract 5 minutes from the timer",
		subtract15Minutes: "Subtract 15 minutes from the timer",
		subtract30Minutes: "Subtract 30 minutes from the timer",
		subtract45Minutes: "Subtract 45 minutes from the timer",
		subtract60Minutes: "Subtract 60 minutes from the timer",
		totalTime: "Total time: ",
		dayView: "Show today's tasks",
		yesterdayView: "Show yesterday's tasks",
		weeklyView: "Show this week's tasks",
		monthlyView: "Show this month's tasks",
		case: "Case",
		account: "Account",
		createdDate: "Date",
		showCompleted: "View/Hide completed tasks"
	};

	currentRecordId;
	@api 
	get recordId() { return this.currentRecordId; }
	set recordId(value) { this.currentRecordId = value; }
	@api singleTaskOnlyRunning;
	isLoading = true;
	isRendered;
	timetrackInfo;
	categoriesOptions = [];
	@track data = [];
	error;
	timerJobId;
	dayView = true;
	yesterdayView;
	weeklyView;
	monthlyView;
	showNoteModal;
	showCompleted = true;
	note;
	noteEntryId;

	renderedCallback() {
		if (this.isRendered) {
			return;
		}
		this.isRendered = true;

		Promise.all([
			loadStyle(this, fontawesome + '/font-awesome-4.7.0/css/font-awesome.min.css')
		])
		.then(() => {
			this.loadData();
		})
		.catch(error => {
			console.error(error);
			this.error = error;
		});
	}

	connectedCallback() {
		this.dayView = true;
		this.singleTaskOnlyRunning = true;
	}

	loadData() {
		this.notifyLoading(true);
		this.error = null;
		this.timetrackInfo = null;
		getTimetrackInfo({})
			.then(result => {
				if (result) {
					console.dir(result);
					this.timetrackInfo = result;
					this.parseInfo(result);
					this.manageTimer();
				}
				this.notifyLoading(false);
			})
			.catch(error => {
				console.error("error calling apex controller:", error);
				this.timetrackInfo = null;
				this.error = error;
				this.notifyLoading(false);
			});
	}

	notifyLoading(isLoading) {
		if(isLoading && !this.isLoading) {
			this.isLoading = true;
		}
		else if(!isLoading && this.isLoading) {
			this.isLoading = false;
		}
	}

	get hasData() {
		return this.data && this.data.length > 0 && this.data.find(entry => !entry.hidden);
	}

	get hasError() {
		return !!this.error;
	}

	get totalTime() {
		let total = 0;
		if(this.data) {
			this.data.forEach(entry => total += entry.hidden ? 0 : entry.Duration__c);
		}
		return this.formatMilliseconds(total);
	}

	parseInfo(data) {
		this.categoriesOptions = data.categories.map(category => {
			return {
				value: category.Id,
				label: category.Name,
				description: category.Description__c
			};
		});
		this.data = data.entries.map(entry => {
			return this.buildEntry(entry);
		})
	}

	manageTimer() {
		if(!this.data) return;

		const isSomethingRunning = this.data.find(entry => entry.isRunning);

		if(isSomethingRunning && !this.timerJobId) {
			this.timerJobId = setInterval(() => { this.updateStopwatches() }, 1000);
		}
		else if(this.timerJobId) {
			clearInterval(this.timerJobId);
			this.timerJobId = null;
		}
	}

	updateStopwatches() {
		if(!this.data) {
			if(this.timerJobId) {
				clearInterval(this.timerJobId);
				this.timerJobId = null;
			}
			return;
		}

		this.data.forEach(entry => {
			if(entry.isRunning) {
				entry.Duration__c += Date.now() - entry._startEpoch;
				entry._startEpoch = Date.now();
				entry.elapsed = this.formatMilliseconds(entry.Duration__c);
			}
		});
	}

	refresh() {
		console.log('refreshing');
		if(this.hasPendingChanges) {
			this.showToast(this.label.save, this.label.saveAllFirst, 'warning');
			return;
		}

		this.loadData();
	}

	get hasPendingChanges() {
		return this.data && this.data.find(entry => entry.isEdit === true || entry.isNew === true);
	}

	add() {
		const defaultCategory = this.timetrackInfo.categories?.[0];

		const entry = this.buildEntry(null, defaultCategory);
		this.data.unshift(entry);
	}

	async saveEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;
		if(!entry._name) {
			const input = this.template.querySelector(`[data-name="${entry.Id}"]`);
			input.reportValidity();
			return;
		}

		entry.Name = entry._name;
		entry.Category__c = entry._categoryId;
		entry.categoryName = this.timetrackInfo.categories.find(category => category.Id === entry.Category__c).Name;

		try {
			const entryId = entry.isNew ? null : entry.Id;

			if(entry.isNew && this.yesterdayView) {
				const yesterday = new Date();
				yesterday.setDate(yesterday.getDate() - 1);
				entry.Date__c = yesterday;
			}

			const newEntry = await saveTimetrackEntry({timetrackEntryId: entryId, name: entry.Name, categoryId: entry.Category__c, entryDate: entry.Date__c});

			entry.Id = newEntry.Id;
			entry.Start_Date__c = newEntry.Start_Date__c;
			entry.CreatedDate = newEntry.CreatedDate;
			entry.Date__c = newEntry.Date__c;
			entry.isEdit = false;
			entry.isNew = false;
			entry.isModified = false;
			entry.isToday = this.isToday(entry.Date__c);
			entry.isYesterday = this.isYesterday(entry.Date__c);
			entry.isThisWeek = this.isThisWeek(entry.Date__c);
			entry.isThisMonth = this.isThisMonth(entry.Date__c);

			if(this.isLinkingSupported) {
				await this.linkEntry({currentTarget: { dataset: { id: entry.Id}}});
			}
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	editEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;
		entry.isEdit = true;
		entry._name = entry.Name;
		entry._categoryId = entry.Category__c;
	}

	deleteEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;
		entry.isDeleted = true;
	}

	async confirmDeleteEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			if(!entry.isNew) {
				await deleteTimetrackEntry({timetrackEntryId: id});
			}

			const index = this.data.findIndex(entry => entry.Id === id);
			if(index < 0) return;
			this.data.splice(index,1);
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	cancelDeleteEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;
		entry.isDeleted = false;
	}

	cancelEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;
		if(entry.isNew) {
			const index = this.data.findIndex(entry => entry.Id === id);
			if(index < 0) return;
			this.data.splice(index,1);
		}
		else {
			entry._name = entry.Name;
			entry.isEdit = false;
		}
	}

	async add5Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, 5 * 60 * 1000);
	}

	async add15Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, 15 * 60 * 1000);
	}

	async add30Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, 30 * 60 * 1000);
	}

	async add45Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, 45 * 60 * 1000);
	}

	async add60Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, 60 * 60 * 1000);
	}

	async subtract5Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, -5 * 60 * 1000);
	}

	async subtract15Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, -15 * 60 * 1000);
	}

	async subtract30Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, -30 * 60 * 1000);
	}

	async subtract45Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, -45 * 60 * 1000);
	}

	async subtract60Minutes(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;
		await this.addMillisecondsEntry(id, -60 * 60 * 1000);
	}

	async completeEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			if(entry.isRunning) await stopTimetrackEntry({timetrackEntryId: id, epoch: Date.now()});
			const newEntry = await completeTimetrackEntry({timetrackEntryId: id});

			entry.isRunning = false;
			entry._startEpoch = null;
			entry.Completed__c = newEntry.Completed__c;
			entry.Start_Date__c = newEntry.Start_Date__c;
			entry.End_Date__c = newEntry.End_Date__c;
			entry.Stopwatch_Start__c = newEntry.Stopwatch_Start__c;
			entry.Duration__c = newEntry.Duration__c;
			entry.elapsed = this.formatMilliseconds(entry.Duration__c);
			entry.isToday = this.isToday(entry.Date__c);
			entry.isYesterday = this.isYesterday(entry.Date__c);
			entry.isThisWeek = this.isThisWeek(entry.Date__c);
			entry.isThisMonth = this.isThisMonth(entry.Date__c);

			this.manageTimer();
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	async startEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			if(this.singleTaskOnlyRunning) { // find out if there's something running and stop it
				const runningTask = this.data.find(entry => entry.isRunning);
				if(runningTask) {
					await this.stopEntry({currentTarget: { dataset: { id: runningTask.Id}}});
				}
			}

			entry._startEpoch = Date.now();
			const newEntry = await startTimetrackEntry({timetrackEntryId: id, epoch: entry._startEpoch});

			entry.isRunning = true;
			entry.Start_Date__c = newEntry.Start_Date__c;
			entry.Stopwatch_Start__c = newEntry.Stopwatch_Start__c;

			this.manageTimer();
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	async stopEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			const newEntry = await stopTimetrackEntry({timetrackEntryId: id, epoch: Date.now()});

			entry._startEpoch = null;
			entry.isRunning = false;
			entry.Stopwatch_Start__c = newEntry.Stopwatch_Start__c;
			entry.Duration__c = newEntry.Duration__c;
			entry.elapsed = this.formatMilliseconds(entry.Duration__c);

			this.manageTimer();
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	async resetEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			const newEntry = await resetTimetrackEntry({timetrackEntryId: id});

			entry.isRunning = false;
			entry._startEpoch = null;
			entry.Start_Date__c = newEntry.Start_Date__c;
			entry.End_Date__c = newEntry.End_Date__c;
			entry.Stopwatch_Start__c = newEntry.Stopwatch_Start__c;
			entry.Duration__c = newEntry.Duration__c;
			entry.elapsed = this.formatMilliseconds(entry.Duration__c);
			entry.isToday = this.isToday(entry.Date__c);
			entry.isYesterday = this.isYesterday(entry.Date__c);
			entry.isThisWeek = this.isThisWeek(entry.Date__c);
			entry.isThisMonth = this.isThisMonth(entry.Date__c);

			this.manageTimer();
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	async uncompleteEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			const newEntry = await uncompleteTimetrackEntry({timetrackEntryId: id});

			entry.Completed__c = newEntry.Completed__c;
			entry.End_Date__c = newEntry.End_Date__c;
			entry.isToday = this.isToday(entry.Date__c);
			entry.isYesterday = this.isYesterday(entry.Date__c);
			entry.isThisWeek = this.isThisWeek(entry.Date__c);
			entry.isThisMonth = this.isThisMonth(entry.Date__c);
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	async addMillisecondsEntry(id, ms) {
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			const newEntry = await addMillisecondsToTimetrackEntry({timetrackEntryId: id, ms: ms});

			entry.Duration__c = newEntry.Duration__c;
			entry.elapsed = this.formatMilliseconds(entry.Duration__c);
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	handleNameChange(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;
		entry._name = event.target.value;
		entry.isModified = true;
	}

	handleCategoryChange(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;
		entry._categoryId = event.detail.value;
		entry.isModified = true;
	}

	buildEntry(entry, category) {
		const that = this;

		const newEntry = {
			Id: entry ? entry.Id : this.generateUUID(),
			Name: entry ? entry.Name : null,
			CreatedDate: entry ? entry.CreatedDate : null,
			Date__c: entry ? entry.Date__c : null,
			Category__c: entry ? entry.Category__c : category?.Id,
			Completed__c: entry ? entry.Completed__c : false,
			Start_Date__c: entry ? entry.Start_Date__c : null,
			End_Date__c: entry ? entry.End_Date__c : null,
			Duration__c: entry ? entry.Duration__c : 0,
			Stopwatch_Start__c: entry ? entry.Stopwatch_Start__c : null,
			Description__c: entry ? entry.Description__c : null,
			Record_Id__c: entry ? entry.Record_Id__c : null,
			categoryName: entry ? entry.Category__r.Name : null,
			linkName : entry ? (entry.Case__c ? `${this.label.case}: ${entry.Case__r.CaseNumber}` : (entry.Account__c ? `${this.label.account}: ${entry.Account__r.Name}` : null)) : null,
			_name: entry ? entry.Category__r.Name : null,
			_categoryId: entry ? entry.Category__c : category?.Id,
			_startEpoch: entry ? new Date(entry.Stopwatch_Start__c).getTime() : null,
			isEdit: !entry,
			isNew: !entry,
			isDeleted: false,
			isModified: false,
			isRunning: entry ? entry.Stopwatch_Start__c : false,
			get className() { return this.Completed__c ? 'completed' : ''},
			elapsed: this.formatMilliseconds(entry ? entry.Duration__c : 0),
			isToday: this.isToday(entry ? entry.Date__c : null),
			isYesterday: this.isYesterday(entry ? entry.Date__c : null),
			isThisWeek: this.isThisWeek(entry ? entry.Date__c : null),
			isThisMonth: this.isThisMonth(entry ? entry.Date__c : null),
			get hidden() { return ((this.Completed__c && !that.showCompleted) || !(this.isNew || (this.isToday && that.dayView) || (this.isYesterday && that.yesterdayView) || (this.isThisWeek && that.weeklyView) || (this.isThisMonth && that.monthlyView)))},
			get noteVariant() {return this.Description__c ? 'warning' : ''},
			get linkVariant() {return this.Record_Id__c === that.currentRecordId ? 'success' : ''}
		};

		return newEntry;
	}

	formatMilliseconds(ms) {
		if(!ms) ms = 0;
		// Time calculations for hours, minutes, seconds and milliseconds
		const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((ms % (1000 * 60)) / 1000);
		//const milliseconds = Math.floor((ms % (1000)));

		return `${hours.toString().padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	showToast(inputTitle, inputMessage, inputVariant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: inputTitle,
                message: inputMessage,
                variant: inputVariant
            })
        );
    }

	generateUUID() { // Public Domain/MIT
		var d = new Date().getTime();//Timestamp
		var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16;//random number between 0 and 16
			if(d > 0){//Use timestamp until depleted
				r = (d + r)%16 | 0;
				d = Math.floor(d/16);
			} else {//Use microseconds since page-load if supported
				r = (d2 + r)%16 | 0;
				d2 = Math.floor(d2/16);
			}
			return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
		});
	}

	navigateToRecord(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;

		this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
			attributes: {
				recordId: id,
				objectApiName: 'Timetrack_Entry__c',
				actionName: 'view'
			}
        });
    }

	handleDayView() {
		if(!this.dayView) this.dayView = true;
		if(this.dayView && this.yesterdayView) this.yesterdayView = false;
		if(this.dayView && this.weeklyView) this.weeklyView = false;
		if(this.dayView && this.monthlyView) this.monthlyView = false;
	}

	handleYesterdayView() {
		if(!this.yesterdayView) this.yesterdayView = true;
		if(this.yesterdayView && this.dayView) this.dayView = false;
		if(this.yesterdayView && this.weeklyView) this.weeklyView = false;
		if(this.yesterdayView && this.monthlyView) this.monthlyView = false;
	}

	handleWeeklyView() {
		if(!this.weeklyView) this.weeklyView = true;
		if(this.weeklyView && this.dayView) this.dayView = false;
		if(this.weeklyView && this.yesterdayView) this.yesterdayView = false;
		if(this.weeklyView && this.monthlyView) this.monthlyView = false;
	}

	handleMonthlyView() {
		if(!this.monthlyView) this.monthlyView = true;
		if(this.monthlyView && this.dayView) this.dayView = false;
		if(this.monthlyView && this.yesterdayView) this.yesterdayView = false;
		if(this.monthlyView && this.weeklyView) this.weeklyView = false;
	}

	handleShowCompletedView() {
		this.showCompleted = !this.showCompleted;
	}

	isThisWeek(epochDate) {
		if(!epochDate) return false;
		const date = new Date(epochDate);

		const now = new Date();

		const weekDay = (now.getDay() + 6) % 7; // Make sure Sunday is 6, not 0
		const monthDay = now.getDate();
		const mondayThisWeek = monthDay - weekDay;

		const startOfThisWeek = new Date(+now);
		startOfThisWeek.setDate(mondayThisWeek);
		startOfThisWeek.setHours(0, 0, 0, 0);

		const startOfNextWeek = new Date(+startOfThisWeek);
		startOfNextWeek.setDate(mondayThisWeek + 7);

		return date >= startOfThisWeek && date < startOfNextWeek;
	}

	isThisMonth(epochDate) {
		if(!epochDate) return false;
		const date = new Date(epochDate);

		const today = new Date();

		return date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear();
	}

	isToday(epochDate) {
		if(!epochDate) return false;
		const date = new Date(epochDate);

		const today = new Date();

		return date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear();
	}

	isYesterday(epochDate) {
		if(!epochDate) return false;
		const date = new Date(epochDate);

		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1)

		return date.getDate() == yesterday.getDate() && date.getMonth() == yesterday.getMonth() && date.getFullYear() == yesterday.getFullYear();
	}

	toggleNoteModal(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		this.showNoteModal = !this.showNoteModal;

		if(this.showNoteModal) {
			this.note = entry.Description__c;
			this.noteEntryId = entry.Id;
		}
		else {
			this.note = null;
			this.noteEntryId = null;
		}
	}

	async saveNote(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			const newEntry = await setTimetrackDescription({timetrackEntryId: id, description: this.note});

			entry.Description__c = newEntry.Description__c;
			entry.elapsed = this.formatMilliseconds(entry.Duration__c);

			this.note = null;
			this.noteEntryId = null;
			this.showNoteModal = false;
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	handleNoteChange(event) {
		this.note = event.target.value;
	}

	get isLinkingSupported() {
		return this.currentRecordId && (this.currentRecordId.startsWith('001') || this.currentRecordId.startsWith('500'));
	}

	async linkEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			const newEntry = await associateTimetrackWithRecord({timetrackEntryId: id, recordId: this.currentRecordId});

			entry.Record_Id__c = newEntry.Record_Id__c;
			entry.linkName = newEntry.Case__c ? `Case: ${newEntry.Case__r.CaseNumber}` : (newEntry.Account__c ? `Account: ${newEntry.Account__r.Name}` : null);
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	async unlinkEntry(event) {
		const id = event.currentTarget.dataset.id;
		const entry = this.data.find(entry => entry.Id === id);
		if(!entry) return;

		try {
			const newEntry = await associateTimetrackWithRecord({timetrackEntryId: id, recordId: null});

			entry.Record_Id__c = newEntry.Record_Id__c;
			entry.linkName = null;
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, reduceErrors(e)[0], 'error');
		}
	}

	openLinkedRecord(event) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.currentTarget.dataset.id;

		this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
			attributes: {
				recordId: id,
				actionName: 'view'
			}
        });
	}
}