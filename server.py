from flask import Flask, request, jsonify
from flask_cors import CORS
from sec_crawler import SECCrawler

app = Flask(__name__, static_url_path='', static_folder='static')
CORS(app)

@app.route('/')
def index():
    return app.send_static_file('index.html')

crawler = SECCrawler()

@app.route('/api/filings', methods=['GET'])
def get_filings():
    cik = request.args.get('cik', '0001601830') # Recursion CIK by default
    form_group = request.args.get('group')
    year = request.args.get('year')
    
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
    except ValueError:
        page = 1
        per_page = 10

    result = crawler.get_filings(
        cik=cik,
        form_group=form_group,
        year=year,
        page=page,
        per_page=per_page
    )

    if "error" in result:
        return jsonify(result), 500
    
    return jsonify(result)

if __name__ == '__main__':
    print("Server running on http://localhost:5000")
    app.run(debug=True, port=5000)
