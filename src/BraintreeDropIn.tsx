/// <reference types="../typings/MendixHelper" />

import { ValueStatus, EditableValue, ListValue, DynamicValue } from "mendix";
import { Component, ReactNode, createElement } from "react";

import * as braintree from "braintree-web-drop-in";

import { BraintreeDropInContainerProps } from "../typings/BraintreeDropInProps";
import { DropIn, SubmitButtonProps } from "./components/DropIn";
import "./ui/BraintreeDropIn.css";

export default class BraintreeDropIn extends Component<BraintreeDropInContainerProps> {
  progressBar: number | undefined;

  // Braintree handles
  handlePaymentMethod = (payload) => {
    // ...
    this.props.deviceData.setValue(payload.deviceData);
    this.props.nonce.setValue(payload.nonce);
    // Execute microflow
    if (this.props.event_onSubmit?.canExecute && !this.props.event_onSubmit?.isExecuting) this.props.event_onSubmit?.execute();
  }

  onCreate = (instance) => {
    // console.log('onCreate', instance)
    // ...
    // Execute microflow
    if (this.props.event_onCreate?.canExecute) this.props.event_onCreate?.execute();
  }

  onDestroyStart = () => {
    // console.log('onDestroyStart')
    // ...
    // Execute microflow
    if (this.props.event_onDestroyStart?.canExecute) this.props.event_onDestroyStart?.execute();
  }

  onDestroyEnd = () => {
    // console.log('onDestroyEnd')
    // ...
    // Execute microflow
    if (this.props.event_onDestroyEnd?.canExecute) this.props.event_onDestroyEnd?.execute();
    this.hideProgress();
  }

  onError = (error) => {
    // console.log('onError', error)
    // ...
    // Execute microflow
    if (this.props.event_onError?.canExecute) this.props.event_onError?.execute();
    this.hideProgress();
  }

  // Mendix functions
  showProgress = () => {
    if (this.progressBar === undefined) this.progressBar = this.props.event_onSubmit_progress !== 'none' ? mx.ui.showProgress(this.props.event_onSubmit_progressMessage, this.props.event_onSubmit_progress === 'blocking' ? true : false) : undefined;
  }

  hideProgress = () => {
    if (this.progressBar !== undefined) mx.ui.hideProgress(this.progressBar);
    this.progressBar = undefined;
  }

  // Custom submit button
  renderSubmitButton = (props: SubmitButtonProps) => {
    return (
      <button
        className={`btn btn-${this.props.style_submitButton_style} ${this.props.style_submitButton_class}`}
        onClick={props.onClick}
        disabled={props.isDisabled || this.props.event_onSubmit?.isExecuting || !this.props.event_onSubmit?.canExecute}
      >{this.props.style_submitButton_text}</button>
    )
  }

  /** 
   * Checks the status of all ``EditableValue`` fields to make sure they have a ``ValueStatus`` of ``Available``.
   */
  checkFields = (): boolean => {
    let checkField = (field: DynamicValue<any> | EditableValue<any> | ListValue | undefined): boolean => {
      return !field || field?.status !== ValueStatus.Loading
    }

    // Check the status of all the enabled props
    let status = (
      // Check option fields
      this.props.options_authorization?.status === ValueStatus.Available &&
      // Check PayPal fields
      (
        this.props.options_payPal ? 
        checkField(this.props.payPal_amount) &&
        checkField(this.props.payPal_lineItems_data) &&
        checkField(this.props.payPal_currency)
        : true
      ) &&
      // Check Apple Pay fields
      (
        this.props.options_applePay ?
        checkField(this.props.applePay_paymentRequest_total_amount) &&
        checkField(this.props.applePay_paymentRequest_lineItem_data) &&
        checkField(this.props.applePay_paymentRequest_countryCode) &&
        checkField(this.props.applePay_paymentRequest_currencyCode)
        : true
      ) &&
      // Check Google Pay fields
      (
        this.props.options_googlePay ?
        checkField(this.props.googlePay_transactionInfo_totalPrice) &&
        checkField(this.props.googlePay_merchantId) &&
        checkField(this.props.googlePay_transactionInfo_displayItems_data) &&
        checkField(this.props.googlePay_transactionInfo_countryCode) &&
        checkField(this.props.googlePay_transactionInfo_currencyCode)
        : true
      ) &&
      // Check 3DS fields
      (
        this.props.options_threeDSecure ? 
        checkField(this.props.threeDS_amount) &&
        checkField(this.props.threeDS_billing_countryCodeAlpha2) &&
        checkField(this.props.threeDS_billing_extendedAddress) &&
        checkField(this.props.threeDS_billing_givenName) &&
        checkField(this.props.threeDS_billing_lineThree) &&
        checkField(this.props.threeDS_billing_locality) &&
        checkField(this.props.threeDS_billing_phoneNumber) &&
        checkField(this.props.threeDS_billing_postalCode) &&
        checkField(this.props.threeDS_billing_region) &&
        checkField(this.props.threeDS_billing_streetAddress) &&
        checkField(this.props.threeDS_billing_surname) &&
        checkField(this.props.threeDS_email) &&
        checkField(this.props.threeDS_mobilePhoneNumber)
        : true
      )
    );
    // Check the status of Mendix object attributes
    if (status && this.props.card_overrides_fields.length) {
      for (var fieldOverride of this.props.card_overrides_fields) {
        status = status && checkField(fieldOverride.prefill);
      }
    }

    return status;
  }

  trimValue = (value: any): typeof value | undefined => {
    if (typeof value === "string") {
      if (value.trim() !== "") return value;
      else return undefined;
    }
    return value;
  }

  trimEnum = (value: any): typeof value | undefined => {
    let newValue = this.trimValue(value);
    if (typeof newValue === "string") return newValue.replace(/[_-]*$|^[_-]*/gm, "");
    return newValue;
  }

  splitString = (value: String): Array<any> | undefined => {
    let newValue = this.trimValue(value);
    if (newValue !== undefined) return newValue.replace(/\ *,\ *$|^\ *,\ */gm, "").split(/\ *,\ */gm);
    return undefined
  }

  /** 
   * Generates the JSON structure for the "braintree-web-drop-in" ``create`` options.
   */
  getOptionsJSON = () => {
    // Split functions
    // Card -> Field overrides
    let getCardFields = () => {
      let fields = {};
      if (this.props.card_overrides_fields && this.props.card_overrides_fields.length) {
        for (var fieldOverride of this.props.card_overrides_fields) {
          fields[fieldOverride.fieldOptions] = {
            // "selector": ?,
            // "container": ?,
            "iframeTitle": this.trimValue(fieldOverride.iframeTitle),
            "internalLabel": this.trimValue(fieldOverride.internalLabel),
            "placeholder": this.trimValue(fieldOverride.placeholder),
            "type": this.trimValue(fieldOverride.type),
            "formatInput": fieldOverride.formatInput,
            "maskInput": fieldOverride.maskInput ? { "character": this.trimValue(fieldOverride.maskInput_character), "showLastFour": fieldOverride.maskInput_showLastFour } : false,
            "select": fieldOverride.select,
            "maxCardLength": fieldOverride.maxCardLength,
            "maxlength": fieldOverride.maxlength,
            "minlength": fieldOverride.minlength,
            "prefill": this.trimValue(fieldOverride.prefill?.value),
            // "supportedCardBrands": ?
          }
        }
      }
      return fields;
    }

    // Apple pay -> Line items
    let getApplePayLineItems = () => {
      let lineItems: Array<any> = [];
      if (
        this.props.applePay_paymentRequest_lineItem_data?.items?.length &&
        this.props.applePay_paymentRequest_lineItem_amount &&
        this.props.applePay_paymentRequest_lineItem_label &&
        this.props.applePay_paymentRequest_lineItem_type
        ) {
        for (var mendixData of this.props.applePay_paymentRequest_lineItem_data.items) {
          let lineItem = {
            "type": this.trimEnum(this.props.applePay_paymentRequest_lineItem_type(mendixData).value),
            "label": this.trimValue(this.props.applePay_paymentRequest_lineItem_label(mendixData).value),
            "amount": this.props.applePay_paymentRequest_lineItem_amount(mendixData).value?.toString()
          }
          lineItems.push(lineItem)
        }
      }
      return lineItems;
    }

    // PayPal -> Line items
    let getPayPalLineItems = () => {
      let lineItems: Array<any> = [];
      if (
        this.props.payPal_lineItems_data?.items?.length &&
        this.props.payPal_lineItems_unitAmount &&
        this.props.payPal_lineItems_name
      ) {
        for (var mendixData of this.props.payPal_lineItems_data?.items) {
          let unitTaxAmount = this.props.payPal_lineItems_unitTaxAmount ? this.props.payPal_lineItems_unitTaxAmount(mendixData).value : undefined;
          let lineItem = {
            "quantity": this.props.payPal_lineItems_quantity ? this.props.payPal_lineItems_quantity(mendixData).value?.toString() : "1",
            "unitAmount": this.props.payPal_lineItems_unitAmount(mendixData).value?.toString(),
            "name": this.trimValue(this.props.payPal_lineItems_name(mendixData).value),
            "kind": this.props.payPal_lineItems_kind ? this.trimEnum(this.props.payPal_lineItems_kind(mendixData).value) : "debit",
            "unitTaxAmount": unitTaxAmount?.gt(0) ? unitTaxAmount.toString() : undefined,
            "description": this.props.payPal_lineItems_description ? this.trimValue(this.props.payPal_lineItems_description(mendixData).value) : undefined,
            "productCode": this.props.payPal_lineItems_productCode ? this.trimValue(this.props.payPal_lineItems_productCode(mendixData).value) : undefined,
            "url": this.props.payPal_lineItems_url ? this.trimValue(this.props.payPal_lineItems_url(mendixData).value) : undefined
          }
          lineItems.push(lineItem)
        }
      }
      return lineItems;
    }

    // Google pay -> Display items
    let getGooglePayDisplayItems = () => {
      let lineItems: Array<any> = [];
      if (
        this.props.googlePay_transactionInfo_displayItems_data?.items?.length &&
        this.props.googlePay_transactionInfo_displayItems_label &&
        this.props.googlePay_transactionInfo_displayItems_price
      ) {
        for (var mendixData of this.props.googlePay_transactionInfo_displayItems_data?.items) {
          let lineItem = {
            "label": this.trimValue(this.props.googlePay_transactionInfo_displayItems_label(mendixData).value),
            "type": this.props.googlePay_transactionInfo_displayItems_type ? this.trimEnum(this.props.googlePay_transactionInfo_displayItems_type(mendixData).value) : "LINE_ITEM",
            "price": this.props.googlePay_transactionInfo_displayItems_price(mendixData).value?.toString(),
            "status": this.props.googlePay_transactionInfo_displayItems_status ? this.trimEnum(this.props.googlePay_transactionInfo_displayItems_status(mendixData).value) : "FINAL"
          }
          lineItems.push(lineItem)
        }
      }
      return lineItems;
    }

    if (this.props.options_authorization?.value) {
      // Options
      let options = { 
        "authorization": this.props.options_authorization?.value,
        "container": "",
        "dataCollector": this.props.options_dataCollector,
        "locale": this.props.options_locale,
        "paymentOptionPriority": this.splitString(this.props.options_paymentOptionPriority),
        "preselectVaultedPaymentMethod": this.props.options_preselectVaultedPaymentMethod,
        "threeDSecure": this.props.options_threeDSecure,
        "venmo": this.props.options_venmo,
        "vaultManager": this.props.options_vaultManager,
      }
      // Options -> Card
      if (this.props.options_card) {       
        options["card"] = {
          "cardholderName": this.props.card_cardholderName_required ? { "required": true } : this.props.card_cardholderName,
          "clearFieldsAfterTokenization": this.props.card_clearFieldsAfterTokenization,
          "overrides": {
            "fields": getCardFields(),
            // TODO -- "styles": {}
          },
          "vault" : {
            "allowVaultCardOverride": this.props.card_vault_allowVaultCardOverride,
            "vaultCard": this.props.card_vault_vaultCard
          }
        }
      }
      else {
        options["card"] = this.props.options_card;
      }
      // Options -> PayPal
      if (this.props.options_payPal) {
        options["paypal"] = {
          "amount": this.props.payPal_amount?.value?.toString(),
          "buttonStyle": {
            "color": this.props.payPal_buttonStyle_color,
            "label": this.props.payPal_buttonStyle_label,
            "shape": this.props.payPal_buttonStyle_shape,
            "size": this.props.payPal_buttonStyle_size,
            "tagline": this.props.payPal_buttonStyle_tagline
          },
          "commit": this.props.payPal_commit,
          "currency": this.trimValue(this.props.payPal_currency?.value),
          "flow": this.props.payPal_flow,
          "vault": { 
            "vaultPayPal": this.props.payPal_vault_vaultPayPal
          },
          "lineItems": getPayPalLineItems()
        }
      }
      // Options -> Apple Pay
      if (this.props.options_applePay) {
        options["applePay"] = {
          "applePaySessionVersion": this.props.applePay_applePaySessionVersion,
          "buttonStyle": this.props.applePay_buttonStyle.replace('_', '-'),
          "displayName": this.trimValue(this.props.applePay_displayName),
          "paymentRequest": { 
            // TODO -- "billingContact": {
              // "phoneNumber": ?,
              // "emailAddress": ?,
              // "givenName": ?,
              // "familyName": ?,
              // "phoneticGivenName": ?,
              // "phoneticFamilyName": ?,
              // "addressLines": ?,
              // "subLocality": ?,
              // "locality": ?,
              // "postalCode": ?,
              // "subAdministrativeArea": ?,
              // "administrativeArea": ?,
              // "country": ?,
              // "countryCode": ?
            // },
            "countryCode": this.trimValue(this.props.applePay_paymentRequest_countryCode?.value),
            "currencyCode": this.trimValue(this.props.applePay_paymentRequest_currencyCode?.value),
            "merchantCapabilities": this.splitString(`supports3DS, ${this.props.applePay_paymentRequest_merchantCapabilities}`),
            "requiredBillingContactFields": this.splitString(this.props.applePay_paymentRequest_requiredBillingContactFields),
            // TODO -- "requiredShippingContactFields": ["email", "name", "phone", "postalAddress"],
            // TODO -- "shippingContact": {
              // "phoneNumber": ?,
              // "emailAddress": ?,
              // "givenName": ?,
              // "familyName": ?,
              // "phoneticGivenName": ?,
              // "phoneticFamilyName": ?,
              // "addressLines": ?,
              // "subLocality": ?,
              // "locality": ?,
              // "postalCode": ?,
              // "subAdministrativeArea": ?,
              // "administrativeArea": ?,
              // "country": ?,
              // "countryCode": ?
            // },
            // TODO -- "shippingMethods": [
            //   {
            //     "label": "Free Shipping",
            //     "detail": "Arrives in 5 to 7 days",
            //     "amount": "0.00",
            //     "identifier": "FreeShip",
            //     "dateComponentsRange": {
            //       "startDateComponents": {
            //         "years": 0,
            //         "months": 0,
            //         "days": 0,
            //         "hours": 0
            //       },
            //       "endDateComponents": {
            //         "years": 0,
            //         "months": 0,
            //         "days": 0,
            //         "hours": 0
            //       }
            //     }
            //   }
            // ],
            // TODO -- "shippingType": "shipping" |"delivery" | "storePickup" | "servicePickup",
            "supportedNetworks": this.splitString(this.props.applePay_paymentRequest_supportedNetworks),
            "total": {
              "amount": this.props.applePay_paymentRequest_total_amount?.value?.toString(),
              "label": this.trimValue(this.props.applePay_paymentRequest_total_label),
              "type": this.props.applePay_paymentRequest_total_type
            },
            "lineItems": getApplePayLineItems()
          }
        }
      }
      // Options -> Google Pay
      if (this.props.options_googlePay) {
        options["googlePay"] = {
          "button": {
            "buttonColor": this.props.googlePay_button_buttonColor,
            // TODO -- "buttonLocale": ?,
            "buttonSizeMode": this.props.googlePay_button_buttonSizeMode,
            "buttonType": this.props.googlePay_button_buttonType
          },
          "googlePayVersion": this.props.googlePay_googlePayVersion,
          "merchantId": this.trimValue(this.props.googlePay_merchantId?.value),
          "transactionInfo": {
            "checkoutOption": this.props.googlePay_transactionInfo_checkoutOption,
            "countryCode": this.trimValue(this.props.googlePay_transactionInfo_countryCode?.value),
            "currencyCode": this.trimValue(this.props.googlePay_transactionInfo_currencyCode?.value),
            "displayItems": getGooglePayDisplayItems(),
            "totalPrice": this.props.googlePay_transactionInfo_totalPrice?.value?.toString(),
            "totalPriceLabel": this.trimValue(this.props.googlePay_transactionInfo_totalPriceLabel),
            "totalPriceStatus": this.props.googlePay_transactionInfo_totalPriceStatus,
            // TODO -- "transactionId": ?,
            // TODO -- "transactionNote": ?
          }
        }
      }
      // Options result
      return options;
    }
    throw Error('Authorization missing');
  }

  /** 
   * Generates the JSON structure for the "braintree-web-drop-in" ``requestPaymentMethod`` options.
   */
  getPaymentMethodOptions = (): braintree.PaymentMethodOptions | undefined => {
    if (this.props.options_threeDSecure) {
      let paymentMethodOptions: braintree.PaymentMethodOptions = {
        threeDSecure: {
          "amount": this.props.threeDS_amount?.value?.toString() || "0",
          "email": this.trimValue(this.props.threeDS_email?.value),
          "mobilePhoneNumber": this.trimValue(this.props.threeDS_mobilePhoneNumber?.value?.replace(/[^0-9]/gm, '')), // Replace all non-numeric
          "billingAddress": {
            "givenName": this.trimValue(this.props.threeDS_billing_givenName?.value),
            "surname": this.trimValue(this.props.threeDS_billing_surname?.value),
            "phoneNumber": this.trimValue(this.props.threeDS_billing_phoneNumber?.value?.replace(/[^0-9]/gm, '')), // Replace all non-numeric
            "streetAddress": this.trimValue(this.props.threeDS_billing_streetAddress?.value),
            "extendedAddress": this.trimValue(this.props.threeDS_billing_extendedAddress?.value),
            "line3": this.trimValue(this.props.threeDS_billing_lineThree?.value),
            "locality": this.trimValue(this.props.threeDS_billing_locality?.value),
            "region": this.trimValue(this.props.threeDS_billing_region?.value),
            "postalCode": this.trimValue(this.props.threeDS_billing_postalCode?.value),
            "countryCodeAlpha2": this.trimValue(this.props.threeDS_billing_countryCodeAlpha2?.value)
          }
        }
      }
      return paymentMethodOptions;
    }
    return undefined;
  }

  // React handles
  componentDidUpdate(prevProps) {
    // Check if submit status has changed?
    if (this.props.event_onSubmit?.isExecuting !== prevProps.event_onSubmit?.isExecuting) {
      // ... if so, show or hide the progress bar
      if (this.props.event_onSubmit?.isExecuting) {
        this.showProgress();
      } else {
        this.hideProgress();
      }
    }
  }

  render(): ReactNode {
    try {
      if (this.checkFields()) {
          const options: braintree.Options = this.getOptionsJSON();
          const paymentMethodOptions: braintree.PaymentMethodOptions | undefined = this.getPaymentMethodOptions();
          return (
            <DropIn
              options={options}
              paymentMethodOptions={paymentMethodOptions}
              handlePaymentMethod={this.handlePaymentMethod}
              onSubmit={this.showProgress}
              onCreate={this.onCreate}
              onDestroyEnd={this.onDestroyEnd}
              onDestroyStart={this.onDestroyStart}
              onError={this.onError}
              className={this.props.class}
              renderSubmitButton={this.renderSubmitButton}
            ></DropIn>
          );
      }
      else {
        return null;
      }
    }
    catch(err) {
      let message = err instanceof Error ? err.message : 'An error occurred';
      return (<p className="alert alert-danger">{ message }</p>);
    }
  }
}
