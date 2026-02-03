import requests
from datetime import datetime

class SECCrawler:
    def __init__(self, user_agent="Your Company Name admin@yourcompany.com"):
        self.headers = {'User-Agent': user_agent}
        self.base_url = "https://data.sec.gov/submissions/"
        self.form_groups = {
            "3,4,5": ["3", "4", "5"],
            "Annual Filings": ["10-K", "20-F", "40-F"],
            "Quarterly Filings": ["10-Q"],
            "Current Reports": ["8-K", "6-K"],
            "Proxy Filings": ["DEF 14A", "DEFA14A", "PRE 14A", "DEFM14A"],
            "Registration Statements": ["S-1", "S-3", "S-4", "S-8", "F-1", "F-3", "F-4", "424B"],
            "Mergers & Acquisitions": ["425", "SC TO", "SC 13E", "CB"],
            "Other": [] # Fallback
        }

    def _get_group_for_form(self, form_type):
        for group, forms in self.form_groups.items():
            # Check for partial match (e.g., S-8 POS matches S-8) but be careful
            # strict match for now or startswith
            for f in forms:
                if form_type.startswith(f):
                    return group
        return "Other"

    def get_filings(self, cik, form_group=None, year=None, page=1, per_page=10):
        """
        Fetches and filters SEC filings.
        
        :param cik: The CIK number of the company.
        :param form_group: (Optional) Filter by filing group.
        :param year: (Optional) Filter by year.
        :param page: Page number (1-based).
        :param per_page: Items per page.
        :return: Dictionary containing filtered results and metadata.
        """
        cik_formatted = str(cik).zfill(10)
        url = f"{self.base_url}CIK{cik_formatted}.json"
        
        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code != 200:
                return {"error": f"Failed to retrieve data. Status Code: {response.status_code}"}
            
            data = response.json()
            filings = data.get('filings', {}).get('recent', {})
            
            if not filings:
                return {"data": [], "total": 0, "page": page, "per_page": per_page}

            # Convert structure from column-arrays to row-objects for easier processing
            # filingDate, form, accessionNumber, primaryDocument, primaryDocDescription
            dates = filings.get('filingDate', [])
            forms = filings.get('form', [])
            accession_numbers = filings.get('accessionNumber', [])
            primary_documents = filings.get('primaryDocument', [])
            descriptions = filings.get('primaryDocDescription', [])
            
            records = []
            available_years = set()
            available_groups = set()

            for i in range(len(dates)):
                form_type = forms[i]
                filing_date = dates[i]
                group = self._get_group_for_form(form_type)
                
                # Collect metadata for filters
                available_years.add(filing_date[:4])
                available_groups.add(group)

                records.append({
                    "date": filing_date,
                    "form": form_type,
                    "group": group,
                    "accessionNumber": accession_numbers[i],
                    "primaryDocument": primary_documents[i],
                    "description": descriptions[i] if i < len(descriptions) else "",
                    "link": f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_numbers[i].replace('-', '')}/{primary_documents[i]}",
                    "details_link": f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_numbers[i].replace('-', '')}/{accession_numbers[i]}-index.html"
                })
            
            # Apply Filters
            filtered_records = records

            if form_group and form_group != "All":
                filtered_records = [r for r in filtered_records if r['group'] == form_group]

            if year and year != "All":
                filtered_records = [r for r in filtered_records if r['date'].startswith(str(year))]


            # Pagination
            total_records = len(filtered_records)
            start_index = (page - 1) * per_page
            end_index = start_index + per_page
            
            paginated_results = filtered_records[start_index:end_index]

            return {
                "data": paginated_results,
                "total": total_records,
                "page": page,
                "pages_total": (total_records + per_page - 1) // per_page,
                "company_name": data.get('name', 'Unknown'),
                "available_years": sorted(list(available_years), reverse=True),
                "available_groups": sorted(list(available_groups))
            }

        except Exception as e:
            return {"error": str(e)}

# Example Usage
if __name__ == "__main__":
    crawler = SECCrawler()
    # Example: Recursion Pharmaceuticals, Inc. (CIK assumed/searched generally, but using Apple as test or user input)
    # Let's stick to the user's previous CIK for Apple, or ask for one.
    # Recursion's CIK is 0001601830
    
    # Test with Apple
    result = crawler.get_filings("0000320193", form_type="8-K", limit=5) # Note signature changed, fixing below
    # Fixing usage to match new signature
    result = crawler.get_filings("0000320193", form_type="8-K", page=1, per_page=5)
    
    if "error" in result:
        print(result["error"])
    else:
        print(f"Filings for {result['company_name']} (Total: {result['total']})")
        for item in result['data']:
            print(f"{item['date']} | {item['form']} | {item['description']}")
