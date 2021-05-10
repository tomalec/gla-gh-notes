/**
 * External dependencies
 */
import { omitBy, isUndefined } from 'lodash';
import {
	getCurrentDates,
	getDateParamsFromQuery,
	isoDateFormat,
} from '@woocommerce/date';
// We are waiting for the release of the following fixes:
// https://github.com/woocommerce/woocommerce-admin/issues/6890
// https://github.com/woocommerce/woocommerce-admin/issues/6062
// import { ReportFilters } from '@woocommerce/components';

/**
 * Internal dependencies
 */
import {
	recordDatepickerUpdateEvent,
	recordFilterEvent,
} from '.~/utils/recordEvent';
import { programsFilter } from './filter-config';
import useAdsCampaigns from '.~/hooks/useAdsCampaigns';
import useStoreCurrency from '.~/hooks/useStoreCurrency';
import ReportFilters from '.~/external-components/woocommerce/filters';

// TODO: Consider importing it from something like '@woocommerce/wc-admin-settings'.
const siteLocale = wcSettings.locale.siteLocale;

/**
 * Set of filters to be used in Programs Report page.
 * Contains date and program pickers.
 *
 * @see https://github.com/woocommerce/woocommerce-admin/blob/main/client/analytics/components/report-filters/index.js
 *
 * @param {Object} props
 * @param {Object} props.query Search query object, to fetch filter values from.
 * @param {string} props.report Report ID used in tracking events.
 */
const ProgramsReportFilters = ( props ) => {
	const { query, report } = props;
	const { data: adsCampaigns } = useAdsCampaigns();

	const { period, compare, before, after } = getDateParamsFromQuery( query );
	const { primary: primaryDate, secondary: secondaryDate } = getCurrentDates(
		query
	);
	const dateQuery = {
		period,
		compare,
		before,
		after,
		primaryDate,
		secondaryDate,
	};

	const currency = useStoreCurrency();

	/**
	 * Record datepicker update tracking event.
	 * Forward all defined data.
	 *
	 * @param {Object} data Data to be forwarded from ReportFilters' date picker.
	 */
	const onDateSelect = ( data ) =>
		recordDatepickerUpdateEvent( {
			report,
			...omitBy( data, isUndefined ),
		} );

	/**
	 * Record filter tracking event.
	 * Forward selected values of products and variations filters.
	 *
	 * @param {Object} data Data to be forwarded from ReportFilters.
	 */
	const onFilterSelect = ( data ) =>
		recordFilterEvent( {
			report,
			filter: data.filter || 'all',
		} );

	const updatedQuery = { ...query };

	const filtersConfig = [ programsFilter( adsCampaigns ) ];

	return (
		<ReportFilters
			query={ updatedQuery }
			siteLocale={ siteLocale }
			currency={ currency }
			filters={ filtersConfig }
			onDateSelect={ onDateSelect }
			onFilterSelect={ onFilterSelect }
			path={ query.path }
			dateQuery={ dateQuery }
			isoDateFormat={ isoDateFormat }
		/>
	);
};

export default ProgramsReportFilters;