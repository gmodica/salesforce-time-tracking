import { LightningElement, api } from 'lwc';
import illustrations from '@salesforce/resourceUrl/illustrations';

export default class Illustration extends LightningElement {
    @api header;
    @api subHeader;
    isHeader;
    isSubHeader;
    illustration;
    illustrationType;

    connectedCallback(){
        this.isHeader = (this.header != null && this.header !== '') ? true : false;
        this.isSubHeader = (this.subHeader != null && this.subHeader != '') ? true : false;
    }

    @api
    get type() {
        return this.illustrationType;
    }

    set type(value) {
        this.illustrationType = value;

        if (value != null && value !== '') {
            this.illustration = illustrations + '/' + value + '.svg';
        }
    }
}