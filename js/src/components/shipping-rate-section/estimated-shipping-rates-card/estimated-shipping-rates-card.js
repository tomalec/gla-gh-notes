/**
 * External dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import GridiconPlusSmall from 'gridicons/dist/plus-small';

/**
 * Internal dependencies
 */
import Section from '.~/wcdl/section';
import AppButtonModalTrigger from '.~/components/app-button-modal-trigger';
import VerticalGapLayout from '.~/components/vertical-gap-layout';
import useStoreCurrency from '.~/hooks/useStoreCurrency';
import groupShippingRatesByMethodCurrencyRate from './groupShippingRatesByMethodCurrencyRate';
import ShippingRateInputControl from './shipping-rate-input-control';
import AddRateFormModal from './add-rate-form-modal';
import { SHIPPING_RATE_METHOD } from '.~/constants';
import isNonFreeFlatShippingRate from '.~/utils/isNonFreeFlatShippingRate';

/**
 * @typedef { import(".~/data/actions").ShippingRate } ShippingRate
 * @typedef { import(".~/data/actions").CountryCode } CountryCode
 * @typedef { import("./typedefs").ShippingRateGroup } ShippingRateGroup
 */

const defaultShippingRate = {
	method: SHIPPING_RATE_METHOD.FLAT_RATE,
	options: {},
};

/**
 * Partial form to provide shipping rates for individual countries,
 * with an UI, that allows to aggregate countries with the same rate.
 *
 * @param {Object} props
 * @param {Array<ShippingRate>} props.value Array of individual shipping rates to be used as the initial values of the form.
 * @param {Array<CountryCode>} props.audienceCountries Array of country codes of all audience countries.
 * @param {(newValue: Array<ShippingRate>) => void} props.onChange Callback called with new data once shipping rates are changed.
 */
export default function EstimatedShippingRatesCard( {
	value: shippingRates,
	audienceCountries,
	onChange,
} ) {
	const { code: currencyCode } = useStoreCurrency();

	// Group countries with the same method, currency and rate.
	const groups = groupShippingRatesByMethodCurrencyRate( shippingRates );

	/**
	 * Event handler for adding new shipping rate group.
	 *
	 * Shipping rate group will be converted into shipping rates, and propagate up via `onChange`.
	 *
	 * @param {ShippingRateGroup} newGroup Shipping rate group.
	 */
	const handleAddSubmit = ( { countries, method, currency, rate } ) => {
		const newShippingRates = countries.map( ( country ) => ( {
			...defaultShippingRate,
			country,
			method,
			currency,
			rate,
		} ) );

		onChange( shippingRates.concat( newShippingRates ) );
	};

	/**
	 * Get the `onChange` event handler for shipping rate group.
	 *
	 * @param {ShippingRateGroup} oldGroup Old shipping rate group.
	 */
	const getChangeHandler = ( oldGroup ) => {
		/**
		 * @param {ShippingRateGroup} newGroup New shipping rate group from `onChange` event.
		 */
		const handleChange = ( newGroup ) => {
			/*
			 * Create new shipping rates value by filtering out deleted countries first.
			 *
			 * A country is deleted when it exists in `oldGroup` and not exists in `newGroup`.
			 */
			const newValue = shippingRates.filter( ( shippingRate ) => {
				const isDeleted =
					oldGroup.countries.includes( shippingRate.country ) &&
					! newGroup.countries.includes( shippingRate.country );
				return ! isDeleted;
			} );

			/*
			 * Upsert shipping rates in `newValue` by looping through `newGroup.countries`.
			 */
			newGroup.countries.forEach( ( country ) => {
				const existingIndex = newValue.findIndex(
					( shippingRate ) => shippingRate.country === country
				);
				const oldShippingRate = newValue[ existingIndex ];
				const newShippingRate = {
					...defaultShippingRate,
					...oldShippingRate,
					country,
					method: newGroup.method,
					currency: newGroup.currency,
					rate: newGroup.rate,
				};

				/*
				 * If the shipping rate is free,
				 * we remove the free_shipping_threshold.
				 */
				if ( ! isNonFreeFlatShippingRate( newShippingRate ) ) {
					newShippingRate.options.free_shipping_threshold = undefined;
				}

				if ( existingIndex >= 0 ) {
					newValue[ existingIndex ] = newShippingRate;
				} else {
					newValue.push( newShippingRate );
				}
			} );

			onChange( newValue );
		};

		return handleChange;
	};

	/**
	 * Get the `onDelete` event handler for shipping rate group.
	 *
	 * @param {ShippingRateGroup} oldGroup Shipping rate group.
	 */
	const getDeleteHandler = ( oldGroup ) => () => {
		const newValue = shippingRates.filter(
			( shippingRate ) =>
				! oldGroup.countries.includes( shippingRate.country )
		);
		onChange( newValue );
	};

	const renderGroups = () => {
		/*
		 * If there is no group, we render a `ShippingRateInputControl`
		 * with a temporary pre-filled group, so that users can staight away
		 * key in shipping rate for all countries immediately.
		 */
		if ( groups.length === 0 ) {
			const tempGroup = {
				countries: audienceCountries,
				method: SHIPPING_RATE_METHOD.FLAT_RATE,
				currency: currencyCode,
				rate: null,
			};
			return (
				<ShippingRateInputControl
					countryOptions={ audienceCountries }
					value={ tempGroup }
					onChange={ getChangeHandler( tempGroup ) }
					onDelete={ getDeleteHandler( tempGroup ) }
				/>
			);
		}

		/*
		 * If there are groups, we render `ShippingRateInputControl` for each group,
		 * and render an "Add rate button" for the remaining countries.
		 */
		const remainingCountries = audienceCountries.filter( ( country ) => {
			const exist = shippingRates.some(
				( shippingRate ) =>
					shippingRate.country === country &&
					shippingRate.method === SHIPPING_RATE_METHOD.FLAT_RATE
			);

			return ! exist;
		} );

		return (
			<>
				{ groups.map( ( group ) => {
					return (
						<ShippingRateInputControl
							key={ group.countries.join( '-' ) }
							countryOptions={ audienceCountries }
							value={ group }
							onChange={ getChangeHandler( group ) }
							onDelete={ getDeleteHandler( group ) }
						/>
					);
				} ) }
				{ remainingCountries.length >= 1 && (
					<div>
						<AppButtonModalTrigger
							button={
								<Button
									isSecondary
									icon={ <GridiconPlusSmall /> }
								>
									{ __(
										'Add another rate',
										'google-listings-and-ads'
									) }
								</Button>
							}
							modal={
								<AddRateFormModal
									countryOptions={ remainingCountries }
									initialValues={ {
										countries: remainingCountries,
										method: SHIPPING_RATE_METHOD.FLAT_RATE,
										currency: currencyCode,
										rate: 0,
									} }
									onSubmit={ handleAddSubmit }
								/>
							}
						/>
					</div>
				) }
			</>
		);
	};

	return (
		<Section.Card>
			<Section.Card.Body>
				<Section.Card.Title>
					{ __(
						'Estimated shipping rates',
						'google-listings-and-ads'
					) }
				</Section.Card.Title>
				<VerticalGapLayout size="large">
					{ renderGroups() }
				</VerticalGapLayout>
			</Section.Card.Body>
		</Section.Card>
	);
}
