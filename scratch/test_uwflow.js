
async function test() {
  const code = "math138";
  const url = "https://uwflow.com/graphql";
  const query = `
    query getCourse($code: String) {
      course(where: {code: {_eq: $code}}) {
        rating {
          liked
          easy
          useful
        }
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({ operationName: "getCourse", variables: { code }, query }),
    });
    const data = await res.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
    const r = data?.data?.course?.[0]?.rating;
    if (r) {
      console.log("Parsed rating:", {
        liked: typeof r.liked === 'number' ? r.liked * 100 : 80,
        easy: typeof r.easy === 'number' ? r.easy * 100 : 80,
        useful: typeof r.useful === 'number' ? r.useful * 100 : 80,
      });
    } else {
      console.log("No rating found");
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

test();
