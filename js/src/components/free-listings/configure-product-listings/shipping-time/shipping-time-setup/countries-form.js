/**
 * External dependencies
 */
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import VerticalGapLayout from '.~/components/vertical-gap-layout';
import AddTimeButton from './add-time-button';
import CountriesTimeInput from './countries-time-input';
import getCountriesTimeArray from './getCountriesTimeArray';

/**
 * @typedef { import(".~/data/actions").CountryCode } CountryCode
 * @typedef { import(".~/data/actions").ShippingTime } ShippingTime
 * @typedef { import(".~/data/actions").AggregatedShippingTime } AggregatedShippingTime
 */

/**
 * Partial form to provide shipping times for individual countries,
 * with an UI, that allows to aggregate countries with the same time.
 *
 * @param {Object} props
 * @param {Array<ShippingTime>} props.shippingTimes Array of individual shipping times to be used as the initial values of the form.
 * @param {Array<CountryCode>} props.selectedCountryCodes Array of country codes of all audience countries.
 */
export default function ShippingCountriesForm( {
	shippingTimes: savedShippingTimes,
	selectedCountryCodes,
} ) {
	const [ shippingTimes, updateShippingTimes ] = useState(
		savedShippingTimes
	);

	const actualCountryCount = shippingTimes.length;
	const actualCountries = new Map(
		shippingTimes.map( ( time ) => [ time.countryCode, time ] )
	);
	const remainingCountryCodes = selectedCountryCodes.filter(
		( el ) => ! actualCountries.has( el )
	);
	const remainingCount = remainingCountryCodes.length;

	// Group countries with the same time.
	const countriesTimeArray = getCountriesTimeArray( shippingTimes );

	if ( countriesTimeArray.length === 0 ) {
		countriesTimeArray.push( {
			countries: selectedCountryCodes,
			time: '',
		} );
	}

	// TODO: move those handlers up to the ancestors and consider optimizing upserting.
	function handleDelete( deletedCountries ) {
		updateShippingTimes(
			shippingTimes.filter(
				( time ) => ! deletedCountries.includes( time.countryCode )
			)
		);
	}
	function handleAdd( { countries, time } ) {
		// Split aggregated time, to individial times per country.
		const addedIndividualTimes = countries.map( ( countryCode ) => ( {
			countryCode,
			time,
		} ) );

		updateShippingTimes( shippingTimes.concat( addedIndividualTimes ) );
	}
	function handleChange( { countries, time }, deletedCountries = [] ) {
		deletedCountries.forEach( ( countryCode ) =>
			actualCountries.delete( countryCode )
		);

		// Upsert times.
		countries.forEach( ( countryCode ) => {
			actualCountries.set( countryCode, {
				countryCode,
				time,
			} );
		} );
		updateShippingTimes( Array.from( actualCountries.values() ) );
	}

	return (
		<div className="countries-time">
			<VerticalGapLayout>
				{ countriesTimeArray.map( ( el ) => {
					return (
						<div
							key={ el.countries.join( '-' ) }
							className="countries-time-input-form"
						>
							<CountriesTimeInput
								value={ el }
								onChange={ handleChange }
								onDelete={ handleDelete }
							/>
						</div>
					);
				} ) }
				{ actualCountryCount >= 1 && remainingCount >= 1 && (
					<div className="add-time-button">
						<AddTimeButton
							countries={ remainingCountryCodes }
							onSubmit={ handleAdd }
						/>
					</div>
				) }
			</VerticalGapLayout>
		</div>
	);
}
