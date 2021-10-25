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
import fontawesome from '@salesforce/resourceUrl/fontawesome';

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
		add15Minutes: "Add 15 minutes to the timer",
		add30Minutes: "Add 30 minutes to the timer",
		add45Minutes: "Add 45 minutes to the timer",
		add60Minutes: "Add 60 minutes to the timer",
		totalTime: "Total time: ",
		dayView: "Show today's completed tasks",
		weeklyView: "Show this week's completed tasks"
	};

	@api singleTaskOnlyRunning;
	isLoading = true;
	isRendered;
	timetrackInfo;
	categoriesOptions = [];
	@track data = [];
	error;
	timerJobId;
	dayView;
	weeklyView;

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
		this.data.push(entry);
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
			const newEntry = await saveTimetrackEntry({timetrackEntryId: entryId, name: entry.Name, categoryId: entry.Category__c});

			entry.Id = newEntry.Id;
			entry.Start_Date__c = newEntry.Start_Date__c;
			entry.isEdit = false;
			entry.isNew = false;
			entry.isModified = false;
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, e.message, 'error');
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
			this.showToast(this.label.error, e.message, 'error');
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
			entry.isToday = this.isToday(entry.End_Date__c);
			entry.isThisWeek = this.isThisWeek(entry.End_Date__c);

			this.manageTimer();
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, e.message, 'error');
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
			this.showToast(this.label.error, e.message, 'error');
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
			this.showToast(this.label.error, e.message, 'error');
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
			entry.isToday = this.isToday(entry.End_Date__c);
			entry.isThisWeek = this.isThisWeek(entry.End_Date__c);

			this.manageTimer();
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, e.message, 'error');
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
			entry.isToday = this.isToday(entry.End_Date__c);
			entry.isThisWeek = this.isThisWeek(entry.End_Date__c);
		}
		catch(e) {
			console.error(e);
			this.showToast(this.label.error, e.message, 'error');
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
			this.showToast(this.label.error, e.message, 'error');
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
			Category__c: entry ? entry.Category__c : category?.Id,
			Completed__c: entry ? entry.Completed__c : false,
			Start_Date__c: entry ? entry.Start_Date__c : null,
			End_Date__c: entry ? entry.End_Date__c : null,
			Duration__c: entry ? entry.Duration__c : 0,
			Stopwatch_Start__c: entry ? entry.Stopwatch_Start__c : null,
			categoryName: entry ? entry.Category__r.Name : null,
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
			isToday: this.isToday(entry ? entry.End_Date__c : null),
			isThisWeek: this.isThisWeek(entry ? entry.End_Date__c : null),
			get hidden() { return (this.isToday || this.isThisWeek) && !((this.isToday && that.dayView) || (this.isThisWeek && that.weeklyView))}
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
		this.dayView = !this.dayView;
		if(this.dayView && this.weeklyView) this.weeklyView = false;
	}

	handleWeeklyView() {
		this.weeklyView = !this.weeklyView;
		if(this.weeklyView && this.dayView) this.dayView = false;
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

	isToday(epochDate) {
		if(!epochDate) return false;
		const date = new Date(epochDate);
		const today = new Date();
		return date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear();
	}
}